import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, readdir, realpath, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultWebRoot = path.join(rootDirectory, 'dist', 'web');
const MAX_BYTES = 2 * 1024 * 1024;
const revisionOf = text => createHash('sha256').update(text).digest('hex');
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
};

// The web page carries this marker; it is replaced with the per-session configuration.
export const configMarker = '<!--outliner-config-->';

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/**
 * File API for one workspace (a folder or a single Markdown file). `handle` serves /api/* and
 * returns false for other paths, so the same API runs in the Node server and the Vite dev server.
 */
export async function createOutlinerApi(workspace) {
  const selected = await realpath(workspace);
  const selectedInfo = await stat(selected);
  const selectedFile = selectedInfo.isFile() ? selected : null;
  if (!selectedInfo.isDirectory() && (!selectedFile || !selectedFile.endsWith('.md') || selectedInfo.size > MAX_BYTES)) {
    throw new Error('Markdown ファイルまたはフォルダーを指定してください。');
  }
  const root = selectedFile ? path.dirname(selectedFile) : selected;
  const initialFile = selectedFile ? path.basename(selectedFile) : 'tasks.md';
  const token = randomBytes(24).toString('hex');
  const busy = new Set();
  const config = { token, initialFile, canCreate: !selectedFile, preferencesKey: 'markdown-outliner:' + revisionOf(selected) };

  function checkRelative(relative) {
    if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.includes('\\') || path.isAbsolute(relative)) {
      throw new RequestError(400, 'Markdown ファイルを指定してください。');
    }
  }

  async function markdownFile(relative) {
    checkRelative(relative);
    if (selectedFile && relative !== initialFile) throw new RequestError(403, '選択したファイルだけを開けます。');
    let full;
    try { full = await realpath(path.resolve(root, relative)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new RequestError(404, '参照先のファイルがありません。');
      throw error;
    }
    if (selectedFile ? full !== selectedFile : !full.startsWith(root + path.sep)) {
      throw new RequestError(403, '選択したファイルまたはフォルダー内のファイルだけを開けます。');
    }
    const info = await stat(full);
    if (!info.isFile() || info.size > MAX_BYTES) throw new RequestError(400, '2MB 以下の Markdown ファイルだけを開けます。');
    return full;
  }

  async function filesIn(directory, prefix = '') {
    const files = [];
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const relative = prefix + item.name;
      if (item.isDirectory()) files.push(...await filesIn(path.join(directory, item.name), relative + '/'));
      else if (item.isFile() && item.name.endsWith('.md')) files.push(relative);
    }
    return files.sort();
  }

  async function save(relative, text, expectedRevision) {
    if (typeof text !== 'string' || typeof expectedRevision !== 'string' || Buffer.byteLength(text) > MAX_BYTES) {
      throw new RequestError(400, '保存内容を確認してください。');
    }
    const full = await markdownFile(relative);
    if (busy.has(full)) throw new RequestError(409, '保存処理が重なりました。入力は保持されています。');
    busy.add(full);
    // The check detects existing external edits; uncoordinated writers can still race the final rename.
    const temporary = full + '.outliner-' + randomBytes(8).toString('hex');
    try {
      if (revisionOf(await readFile(full, 'utf8')) !== expectedRevision) {
        throw new RequestError(409, '外部で変更されています。入力をコピーしてから読み直してください。');
      }
      const info = await stat(full);
      await writeFile(temporary, text, { flag: 'wx', mode: info.mode });
      if (revisionOf(await readFile(full, 'utf8')) !== expectedRevision) {
        throw new RequestError(409, '保存前に外部変更を検知しました。入力は保持されています。');
      }
      await rename(temporary, full);
      if (revisionOf(await readFile(full, 'utf8')) !== revisionOf(text)) {
        throw new RequestError(409, '保存と外部変更が重なりました。ファイルを確認してください。');
      }
      return { revision: revisionOf(text) };
    } finally { busy.delete(full); }
  }

  async function create(relative, text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) throw new RequestError(400, '保存内容を確認してください。');
    checkRelative(relative);
    if (selectedFile) throw new RequestError(403, 'ファイルを指定して開いたときは新しいファイルを作れません。');
    const full = path.resolve(root, relative);
    let directory;
    try { directory = await realpath(path.dirname(full)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new RequestError(404, '保存先のフォルダーがありません。');
      throw error;
    }
    if (directory !== root && !directory.startsWith(root + path.sep)) {
      throw new RequestError(403, '選択したフォルダー内にだけファイルを作れます。');
    }
    // 'wx' fails when anything (including a symlink) already exists at the path.
    try { await writeFile(path.join(directory, path.basename(full)), text, { flag: 'wx' }); }
    catch (error) {
      if (error.code === 'EEXIST') throw new RequestError(409, '同じ名前のファイルがすでにあります。');
      throw error;
    }
    return { revision: revisionOf(text) };
  }

  async function handleApi(request, response, url, expectedHost) {
    if (request.method === 'GET' && url.pathname === '/api/files') return sendJson(response, 200, selectedFile ? [initialFile] : await filesIn(root));
    if (request.method === 'GET' && url.pathname === '/api/file') {
      const text = await readFile(await markdownFile(url.searchParams.get('path')), 'utf8');
      return sendJson(response, 200, { text, revision: revisionOf(text) });
    }
    if (['PUT', 'POST'].includes(request.method) && url.pathname === '/api/file') {
      if (request.headers['x-outliner-token'] !== token) throw new RequestError(403, '保存を許可できません。');
      if (request.headers.origin && request.headers.origin !== `http://${expectedHost}`) throw new RequestError(403, '保存元を確認できません。');
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BYTES * 2) throw new RequestError(413, '保存内容が大きすぎます。');
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new RequestError(400, '保存内容を確認してください。'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError(400, '保存内容を確認してください。');
      const file = url.searchParams.get('path');
      return sendJson(response, 200, request.method === 'PUT' ? await save(file, data.text, data.revision) : await create(file, data.text));
    }
    throw new RequestError(404, '指定した画面がありません。');
  }

  /** Serves /api/* and returns true, or returns false for any other path. */
  async function handle(request, response) {
    if (!request.url.startsWith('/api/')) return false;
    await guarded(request, response, (url, expectedHost) => handleApi(request, response, url, expectedHost));
    return true;
  }

  return { config, handle, injectConfig: html => injectConfig(html, config) };
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

/** Runs a handler after the loopback Host check and turns errors into JSON responses. */
async function guarded(request, response, handler) {
  try {
    // Only the exact loopback address and port this socket accepted on is allowed (DNS rebinding).
    const expectedHost = `127.0.0.1:${request.socket.localPort}`;
    if (request.headers.host !== expectedHost) throw new RequestError(403, 'この接続は許可されていません。');
    await handler(new URL(request.url, `http://${expectedHost}`), expectedHost);
  } catch (error) {
    if (!(error instanceof RequestError)) console.error(error);
    sendJson(response, error instanceof RequestError ? error.status : 500, {
      error: error instanceof RequestError ? error.message : 'ファイル操作に失敗しました。入力を保持してやり直してください。'
    });
  }
}

/** Embeds the session configuration as inert JSON; `<` is escaped so it cannot close the script. */
export function injectConfig(html, config) {
  if (!html.includes(configMarker)) throw new Error('The web page has no configuration marker.');
  const json = JSON.stringify(config).replaceAll('<', '\\u003c');
  return html.replace(configMarker, () => `<script id="outliner-config" type="application/json">${json}</script>`);
}

async function webFiles(directory, prefix = '/') {
  const files = new Map();
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) for (const [name, file] of await webFiles(full, prefix + item.name + '/')) files.set(name, file);
    else if (item.isFile() && contentTypes[path.extname(item.name)]) files.set(prefix + item.name, full);
  }
  return files;
}

/** Serves the built web app from `webRoot` (see `npm run build:web`) plus the file API. */
export async function createOutlinerServer(workspace, { webRoot = defaultWebRoot } = {}) {
  const api = await createOutlinerApi(workspace);
  let files;
  try { files = await webFiles(webRoot); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${webRoot} がありません。先に npm run build:web を実行してください。`);
    throw error;
  }
  const indexFile = files.get('/index.html');
  if (!indexFile) throw new Error(`${webRoot}/index.html がありません。先に npm run build:web を実行してください。`);
  const html = api.injectConfig(await readFile(indexFile, 'utf8'));
  files.delete('/index.html');

  return http.createServer(async (request, response) => {
    if (await api.handle(request, response)) return;
    await guarded(request, response, async url => {
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end(html);
      }
      // Only files that existed in the build output at startup are served.
      const file = request.method === 'GET' ? files.get(url.pathname) : undefined;
      if (!file) throw new RequestError(404, '指定した画面がありません。');
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] + '; charset=utf-8' });
      return response.end(content);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const workspace = process.argv[2] || path.join(rootDirectory, 'samples');
  const port = Number(process.argv[3] || 4317);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = await createOutlinerServer(workspace);
  server.listen(port, '127.0.0.1', () => console.log(`Markdown outliner: http://127.0.0.1:${server.address().port}`));
}
