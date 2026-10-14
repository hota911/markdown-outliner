import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, lstat, mkdir, readFile, readdir, realpath, writeFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultWebRoot = path.join(rootDirectory, 'dist', 'web');
const MAX_BYTES = 2 * 1024 * 1024;
const revisionOf = text => createHash('sha256').update(text).digest('hex');
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
};

// Other files of the folder, opened from links in a new tab (`/api/raw`). Any other type is
// downloaded rather than shown.
const rawTypes = {
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.html': 'text/html',
};

// The same rule as usableBaseName in src/core.ts, which the page checks before asking; repeated
// here so that the server does not depend on the TypeScript sources.
const usableBaseName = name => name !== '' && name === name.trim() && !name.startsWith('.')
  && !/[/\\:*?"<>|#^[\]]/.test(name) && !/\p{Cc}/u.test(name);

// The web page carries this marker; it is replaced with the per-session configuration.
export const configMarker = '<!--outliner-config-->';

// Responses carry a code instead of text; the web page shows it in the display language
// (`server` in src/ui/messages.ts), so the server needs no language of its own.
class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
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
    throw new Error('Specify a Markdown file or a folder.');
  }
  const root = selectedFile ? path.dirname(selectedFile) : selected;
  // Only a single selected file is opened first; for a folder the page picks the file.
  const initialFile = selectedFile ? path.basename(selectedFile) : undefined;
  const token = randomBytes(24).toString('hex');
  const busy = new Set();
  const config = { token, initialFile, canCreate: !selectedFile, preferencesKey: 'markdown-outliner:' + revisionOf(selected) };

  function checkRelative(relative) {
    if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.includes('\\') || path.isAbsolute(relative)) {
      throw new RequestError(400, 'notMarkdown');
    }
  }

  async function markdownFile(relative) {
    checkRelative(relative);
    if (selectedFile && relative !== initialFile) throw new RequestError(403, 'selectedFileOnly');
    let full;
    try { full = await realpath(path.resolve(root, relative)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new RequestError(404, 'fileMissing');
      throw error;
    }
    if (selectedFile ? full !== selectedFile : !full.startsWith(root + path.sep)) {
      throw new RequestError(403, 'outsideWorkspace');
    }
    const info = await stat(full);
    if (!info.isFile() || info.size > MAX_BYTES) throw new RequestError(400, 'fileTooLarge');
    return full;
  }

  // A file of the folder for a link: the first of `candidates` that exists. Hidden files and
  // folders such as `.git` and `.trash` are refused, as they are not listed either.
  async function linkedFile(candidates) {
    if (selectedFile) throw new RequestError(403, 'selectedFileOnly');
    for (const relative of candidates) {
      if (!relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => part.startsWith('.'))) {
        throw new RequestError(403, 'outsideWorkspace');
      }
      let full;
      try { full = await realpath(path.resolve(root, relative)); }
      catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) continue;
        throw error;
      }
      if (!full.startsWith(root + path.sep)) throw new RequestError(403, 'outsideWorkspace');
      if ((await stat(full)).isFile()) return full;
    }
    throw new RequestError(404, 'fileMissing');
  }

  // The page of the outliner holds the save token, so a served file runs in a sandbox, with no
  // scripts and an origin of its own.
  async function sendRaw(response, candidates) {
    const full = await linkedFile(candidates);
    response.writeHead(200, {
      'Content-Type': rawTypes[path.extname(full).toLowerCase()] ?? 'application/octet-stream',
      'Content-Security-Policy': 'sandbox', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
    });
    await new Promise((resolve, reject) => createReadStream(full).on('error', reject).on('end', resolve).pipe(response));
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
      throw new RequestError(400, 'invalidContent');
    }
    const full = await markdownFile(relative);
    if (busy.has(full)) throw new RequestError(409, 'saveBusy');
    busy.add(full);
    // The check detects existing external edits; uncoordinated writers can still race the final rename.
    const temporary = full + '.outliner-' + randomBytes(8).toString('hex');
    try {
      if (revisionOf(await readFile(full, 'utf8')) !== expectedRevision) {
        throw new RequestError(409, 'externalChange');
      }
      const info = await stat(full);
      await writeFile(temporary, text, { flag: 'wx', mode: info.mode });
      if (revisionOf(await readFile(full, 'utf8')) !== expectedRevision) {
        throw new RequestError(409, 'externalChangeBeforeSave');
      }
      await rename(temporary, full);
      if (revisionOf(await readFile(full, 'utf8')) !== revisionOf(text)) {
        throw new RequestError(409, 'saveRace');
      }
      return { revision: revisionOf(text) };
    } finally { busy.delete(full); }
  }

  async function create(relative, text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) throw new RequestError(400, 'invalidContent');
    checkRelative(relative);
    if (selectedFile) throw new RequestError(403, 'createInSingleFile');
    const full = path.resolve(root, relative);
    let directory;
    try { directory = await realpath(path.dirname(full)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new RequestError(404, 'folderMissing');
      throw error;
    }
    if (directory !== root && !directory.startsWith(root + path.sep)) {
      throw new RequestError(403, 'createOutsideFolder');
    }
    // 'wx' fails when anything (including a symlink) already exists at the path.
    try { await writeFile(path.join(directory, path.basename(full)), text, { flag: 'wx' }); }
    catch (error) {
      if (error.code === 'EEXIST') throw new RequestError(409, 'fileExists');
      throw error;
    }
    return { revision: revisionOf(text) };
  }

  // Renames a file within its folder without overwriting anything. Only the base name changes;
  // links to the file in other files are left as they are.
  async function renameFile(from, to) {
    if (selectedFile) throw new RequestError(403, 'renameInSingleFile');
    const full = await markdownFile(from);
    checkRelative(to);
    if (path.posix.dirname(to) !== path.posix.dirname(from)) throw new RequestError(400, 'renameOtherFolder');
    const name = path.posix.basename(to);
    if (!usableBaseName(name.slice(0, -'.md'.length))) throw new RequestError(400, 'invalidName');
    // `full` is the resolved path, so a symlink would rename its target instead of the link.
    const directory = await realpath(path.dirname(path.resolve(root, from)));
    if (path.join(directory, path.posix.basename(from)) !== full) throw new RequestError(400, 'renameSymlink');
    const destination = path.join(directory, name);
    if (busy.has(full)) throw new RequestError(409, 'saveBusy');
    busy.add(full);
    try {
      // A hard link fails when anything already exists at the destination, unlike rename().
      try { await link(full, destination); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // On a case-insensitive file system a change of case only finds the file itself.
        const [source, existing] = await Promise.all([stat(full), lstat(destination)]);
        const sameFile = source.ino === existing.ino && source.dev === existing.dev
          && name.toLowerCase() === path.posix.basename(from).toLowerCase();
        if (!sameFile) throw new RequestError(409, 'fileExists');
        await rename(full, destination);
        return {};
      }
      await unlink(full);
      return {};
    } finally { busy.delete(full); }
  }

  // Moves a file into `.trash/` at the root of the folder; files are never deleted. The trash is
  // flat, so a number is added to the name when the trash already holds one by that name.
  async function trashFile(relative) {
    if (selectedFile) throw new RequestError(403, 'trashInSingleFile');
    const full = await markdownFile(relative);
    // `full` is the resolved path, so a symlink would move its target instead of the link.
    const directory = await realpath(path.dirname(path.resolve(root, relative)));
    if (path.join(directory, path.posix.basename(relative)) !== full) throw new RequestError(400, 'trashSymlink');
    const trash = path.join(root, '.trash');
    await mkdir(trash, { recursive: true });
    // lstat does not follow a symlink, which could lead out of the folder.
    if (!(await lstat(trash)).isDirectory()) throw new RequestError(409, 'trashNotFolder');
    if (busy.has(full)) throw new RequestError(409, 'saveBusy');
    busy.add(full);
    try {
      const base = path.basename(full, '.md');
      for (let number = 1; ; number++) {
        const destination = path.join(trash, (number === 1 ? base : `${base} ${number}`) + '.md');
        // A hard link fails when anything already exists at the destination, unlike rename().
        try { await link(full, destination); }
        catch (error) {
          if (error.code === 'EEXIST') continue;
          throw error;
        }
        await unlink(full);
        return {};
      }
    } finally { busy.delete(full); }
  }

  async function handleApi(request, response, url, expectedHost) {
    if (request.method === 'GET' && url.pathname === '/api/files') return sendJson(response, 200, selectedFile ? [initialFile] : await filesIn(root));
    if (request.method === 'GET' && url.pathname === '/api/file') {
      const text = await readFile(await markdownFile(url.searchParams.get('path')), 'utf8');
      return sendJson(response, 200, { text, revision: revisionOf(text) });
    }
    if (request.method === 'GET' && url.pathname === '/api/raw') return sendRaw(response, url.searchParams.getAll('path'));
    const write = ['PUT', 'POST'].includes(request.method) && url.pathname === '/api/file'
      || request.method === 'POST' && ['/api/rename', '/api/trash'].includes(url.pathname);
    if (write) {
      if (request.headers['x-outliner-token'] !== token) throw new RequestError(403, 'badToken');
      if (request.headers.origin && request.headers.origin !== `http://${expectedHost}`) throw new RequestError(403, 'badOrigin');
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BYTES * 2) throw new RequestError(413, 'contentTooLarge');
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new RequestError(400, 'invalidContent'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError(400, 'invalidContent');
      if (url.pathname === '/api/rename') return sendJson(response, 200, await renameFile(data.from, data.to));
      if (url.pathname === '/api/trash') return sendJson(response, 200, await trashFile(data.path));
      const file = url.searchParams.get('path');
      return sendJson(response, 200, request.method === 'PUT' ? await save(file, data.text, data.revision) : await create(file, data.text));
    }
    throw new RequestError(404, 'notFound');
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
    if (request.headers.host !== expectedHost) throw new RequestError(403, 'hostRejected');
    await handler(new URL(request.url, `http://${expectedHost}`), expectedHost);
  } catch (error) {
    if (!(error instanceof RequestError)) console.error(error);
    sendJson(response, error instanceof RequestError ? error.status : 500, {
      code: error instanceof RequestError ? error.code : 'internal'
    });
  }
}

/** Embeds the session configuration as inert JSON; `<` is escaped so it cannot close the script. */
export function injectConfig(html, config) {
  if (!html.includes(configMarker)) throw new Error('The web page has no configuration marker.');
  const json = JSON.stringify(config).replaceAll('<', '\\u003c');
  return html.replace(configMarker, () => `<script id="outliner-config" type="application/json">${json}</script>`);
}

/**
 * Reads a file of the built web app. Resolved per request so that rebuilding `webRoot` while the
 * server runs takes effect on reload. Missing files and paths outside `webRoot` are 404.
 */
async function readWebFile(webRoot, pathname) {
  try {
    const root = await realpath(webRoot);
    const full = await realpath(path.join(root, pathname));
    if (!full.startsWith(root + path.sep) || !(await stat(full)).isFile()) throw new RequestError(404, 'notFound');
    return await readFile(full);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw new RequestError(404, 'notFound');
    throw error;
  }
}

/** Serves the built web app from `webRoot` (see `npm run build:web`) plus the file API. */
export async function createOutlinerServer(workspace, { webRoot = defaultWebRoot } = {}) {
  const api = await createOutlinerApi(workspace);
  let indexHtml;
  try { indexHtml = await readFile(path.join(webRoot, 'index.html'), 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${webRoot}/index.html does not exist. Run npm run build:web first.`);
    throw error;
  }
  // Fails fast when the page lacks the configuration marker.
  api.injectConfig(indexHtml);

  return http.createServer(async (request, response) => {
    if (await api.handle(request, response)) return;
    await guarded(request, response, async url => {
      if (request.method !== 'GET') throw new RequestError(404, 'notFound');
      if (url.pathname === '/') {
        const html = api.injectConfig((await readWebFile(webRoot, '/index.html')).toString('utf8'));
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end(html);
      }
      // index.html is served only through `/`, with the configuration embedded.
      const contentType = contentTypes[path.extname(url.pathname)];
      if (!contentType || url.pathname === '/index.html') throw new RequestError(404, 'notFound');
      const content = await readWebFile(webRoot, url.pathname);
      response.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
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
