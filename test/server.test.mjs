import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configMarker, createOutlinerServer, injectConfig } from '../server.mjs';
import { messages } from '../src/ui/messages.ts';

// Stands in for the `npm run build:web` output so these tests do not depend on a build.
const webRoot = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-web-'));
await mkdir(path.join(webRoot, 'assets'));
await writeFile(path.join(webRoot, 'index.html'), `<!doctype html><head>${configMarker}</head><script type="module" src="./assets/app.js"></script>`);
await writeFile(path.join(webRoot, 'assets', 'app.js'), 'console.log("app");\n');
await writeFile(path.join(webRoot, 'assets', 'app.css'), 'body {}\n');
await writeFile(path.join(webRoot, 'notes.txt'), 'not served\n');

const configOf = html => JSON.parse(html.match(/<script id="outliner-config" type="application\/json">(.*?)<\/script>/)[1]);

let server, workspace, origin, token;
before(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-test-'));
  await writeFile(path.join(workspace, 'tasks.md'), '# Tasks\n\n- [ ] Draft #work\n');
  await writeFile(path.join(workspace, 'work.md'), '- [/] Embedded #work\n');
  server = await createOutlinerServer(workspace, { webRoot });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(origin)).text();
  token = configOf(html).token;
  assert.match(token, /^[a-f0-9]{48}$/);
  // A folder names no initial file; the page opens the last file shown or the first listed one.
  assert.equal(configOf(html).initialFile, undefined);
});
after(async () => { await new Promise(resolve => server.close(resolve)); });

const read = async file => (await fetch(`${origin}/api/file?path=${encodeURIComponent(file)}`)).json();
const save = (file, text, revision, authentication = token) => fetch(`${origin}/api/file?path=${encodeURIComponent(file)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Outliner-Token': authentication },
  body: JSON.stringify({ text, revision })
});

const create = (base, file, text, authentication) => fetch(`${base}/api/file?path=${encodeURIComponent(file)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Outliner-Token': authentication },
  body: JSON.stringify({ text })
});

test('creates a new Markdown file exclusively inside the selected directory', async () => {
  const response = await create(origin, 'Created task.md', '- [ ] Created task\n', token);
  assert.equal(response.status, 200);
  assert.equal(await readFile(path.join(workspace, 'Created task.md'), 'utf8'), '- [ ] Created task\n');
  assert.equal((await read('Created task.md')).revision, (await response.json()).revision);

  const existing = await create(origin, 'work.md', 'overwritten\n', token);
  assert.equal(existing.status, 409);
  assert.equal(await readFile(path.join(workspace, 'work.md'), 'utf8'), '- [/] Embedded #work\n');

  assert.equal((await create(origin, '../escaped.md', 'escaped\n', token)).status, 403);
  assert.equal((await create(origin, 'missing/new.md', 'new\n', token)).status, 404);
  assert.equal((await create(origin, 'notes.txt', 'text\n', token)).status, 400);
  assert.equal((await create(origin, 'unauthorized.md', 'text\n', 'wrong')).status, 403);
  assert.equal((await fetch(`${origin}/api/file?path=unauthorized.md`)).status, 404);
  await assert.rejects(readFile(path.join(workspace, '..', 'escaped.md'), 'utf8'));
});

test('saves embedded source without changing the parent file', async () => {
  const original = await readFile(path.join(workspace, 'tasks.md'), 'utf8');
  const embedded = await read('work.md');
  const response = await save('work.md', '- [/] Embedded changed #work\n', embedded.revision);
  assert.equal(response.status, 200);
  assert.equal(await readFile(path.join(workspace, 'work.md'), 'utf8'), '- [/] Embedded changed #work\n');
  assert.equal(await readFile(path.join(workspace, 'tasks.md'), 'utf8'), original);
});

test('rejects stale saves and retains the external edit', async () => {
  const loaded = await read('tasks.md');
  const external = '# Tasks\n\n- [/] Changed by an agent\n';
  await writeFile(path.join(workspace, 'tasks.md'), external);
  const response = await save('tasks.md', '# Tasks\n\n- [x] Local edit\n', loaded.revision);
  assert.equal(response.status, 409);
  assert.equal(await readFile(path.join(workspace, 'tasks.md'), 'utf8'), external);
});

test('blocks writes without the per-session token', async () => {
  const loaded = await read('work.md');
  const response = await save('work.md', '- [x] Unexpected\n', loaded.revision, 'wrong');
  assert.equal(response.status, 403);
  assert.equal((await read('work.md')).text, loaded.text);
});

test('blocks paths and symlinks outside the selected directory', async () => {
  const outside = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-outside-'));
  await writeFile(path.join(outside, 'outside.md'), 'Private content\n');
  await symlink(path.join(outside, 'outside.md'), path.join(workspace, 'linked.md'));
  const linked = await fetch(`${origin}/api/file?path=linked.md`);
  const absolute = await fetch(`${origin}/api/file?path=${encodeURIComponent(path.join(outside, 'outside.md'))}`);
  assert.equal(linked.status, 403);
  assert.equal(absolute.status, 400);
  assert.doesNotMatch(await linked.text(), /Private content/);
});

test('serves the built web assets and nothing else', async () => {
  for (const asset of ['/assets/app.js', '/assets/app.css']) {
    assert.equal((await fetch(origin + asset)).status, 200);
  }
  for (const other of ['/notes.txt', '/index.html', '/assets/missing.js', '/server.mjs', '/assets/../../server.mjs']) {
    assert.equal((await fetch(origin + other)).status, 404);
  }
});

test('embeds the configuration so file names cannot close the script element', () => {
  const html = injectConfig(`<head>${configMarker}</head>`, { initialFile: '</script><script>alert(1)</script>.md' });
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.equal(configOf(html).initialFile, '</script><script>alert(1)</script>.md');
});

test('rejects requests for a different Host header', async () => {
  const { request } = await import('node:http');
  const status = await new Promise((resolve, reject) => {
    request(origin + '/api/files', { headers: { host: 'localhost:' + server.address().port } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(status, 403);
});

test('returns explicit errors for missing Markdown and invalid requests', async () => {
  const missing = await fetch(`${origin}/api/file?path=missing.md`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { code: 'fileMissing' });
  const notMarkdown = await fetch(`${origin}/api/file?path=server.mjs`);
  assert.equal(notMarkdown.status, 400);
  assert.deepEqual(await notMarkdown.json(), { code: 'notMarkdown' });
  const response = await fetch(`${origin}/api/file?path=work.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': token }, body: 'not JSON'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { code: 'invalidContent' });
  const nullBody = await fetch(`${origin}/api/file?path=work.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': token }, body: 'null'
  });
  assert.equal(nullBody.status, 400);
});

const renameRequest = (base, from, to, authentication) => fetch(`${base}/api/rename`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Outliner-Token': authentication },
  body: JSON.stringify({ from, to })
});

test('renames a file within its folder without overwriting or leaving the folder', async t => {
  const parent = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-rename-'));
  const directory = path.join(parent, 'root');
  await mkdir(path.join(directory, 'notes'), { recursive: true });
  await writeFile(path.join(directory, 'notes', 'work.md'), '- [ ] job\n');
  await writeFile(path.join(directory, 'notes', 'other.md'), 'keep\n');
  await writeFile(path.join(parent, 'outside.md'), 'outside\n');
  const renameServer = await createOutlinerServer(directory, { webRoot });
  await new Promise(resolve => renameServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => renameServer.close(resolve)));
  const base = `http://127.0.0.1:${renameServer.address().port}`;
  const renameToken = configOf(await (await fetch(base)).text()).token;
  const files = async () => (await (await fetch(`${base}/api/files`)).json()).sort();

  const renamed = await renameRequest(base, 'notes/work.md', 'notes/done jobs.md', renameToken);
  assert.equal(renamed.status, 200);
  assert.deepEqual(await files(), ['notes/done jobs.md', 'notes/other.md']);
  assert.equal(await readFile(path.join(directory, 'notes', 'done jobs.md'), 'utf8'), '- [ ] job\n');

  const existing = await renameRequest(base, 'notes/done jobs.md', 'notes/other.md', renameToken);
  assert.equal(existing.status, 409);
  assert.deepEqual(await existing.json(), { code: 'fileExists' });
  assert.equal(await readFile(path.join(directory, 'notes', 'other.md'), 'utf8'), 'keep\n');

  const rejected = [
    ['notes/done jobs.md', 'notes/.hidden.md', 400, 'invalidName'],
    ['notes/done jobs.md', 'notes/a:b.md', 400, 'invalidName'],
    ['notes/done jobs.md', 'notes/.md', 400, 'invalidName'],
    ['notes/done jobs.md', 'notes/x\\y.md', 400, 'notMarkdown'],
    ['notes/done jobs.md', 'notes/plain.txt', 400, 'notMarkdown'],
    ['notes/done jobs.md', '../escaped.md', 400, 'renameOtherFolder'],
    ['notes/done jobs.md', 'notes/../moved.md', 400, 'renameOtherFolder'],
    ['notes/done jobs.md', 'moved.md', 400, 'renameOtherFolder'],
    ['../outside.md', '../inside.md', 403, 'outsideWorkspace'],
    ['notes/missing.md', 'notes/new.md', 404, 'fileMissing'],
  ];
  for (const [from, to, status, code] of rejected) {
    const response = await renameRequest(base, from, to, renameToken);
    assert.equal(response.status, status, `${from} -> ${to}`);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { code }, `${from} -> ${to}`);
    assert.doesNotMatch(body, new RegExp(parent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal((await renameRequest(base, 'notes/done jobs.md', 'notes/stolen.md', 'wrong')).status, 403);
  assert.deepEqual(await files(), ['notes/done jobs.md', 'notes/other.md']);
  assert.equal(await readFile(path.join(parent, 'outside.md'), 'utf8'), 'outside\n');
  await assert.rejects(readFile(path.join(parent, 'escaped.md'), 'utf8'));
});

test('does not rename through a symbolic link', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-rename-link-'));
  await writeFile(path.join(directory, 'real.md'), 'real\n');
  await symlink(path.join(directory, 'real.md'), path.join(directory, 'link.md'));
  const renameServer = await createOutlinerServer(directory, { webRoot });
  await new Promise(resolve => renameServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => renameServer.close(resolve)));
  const base = `http://127.0.0.1:${renameServer.address().port}`;
  const renameToken = configOf(await (await fetch(base)).text()).token;
  const response = await renameRequest(base, 'link.md', 'renamed.md', renameToken);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { code: 'renameSymlink' });
  assert.equal(await readFile(path.join(directory, 'real.md'), 'utf8'), 'real\n');
});

test('every error code the server returns has text in English and Japanese', async () => {
  const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const codes = [...source.matchAll(/new RequestError\(\d+, '(\w+)'\)/g)].map(match => match[1]).concat('internal');
  assert.ok(codes.length > 20);
  for (const language of ['en', 'ja']) {
    for (const code of codes) assert.equal(typeof messages[language].server[code], 'string', `${language}: ${code}`);
  }
});

test('single-file mode lists, reads and saves only the selected Markdown file', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-single-'));
  const selected = path.join(directory, 'TODO.md');
  const sibling = path.join(directory, 'private.md');
  await writeFile(selected, '# TODO\n\n- [ ] Draft\n');
  await writeFile(sibling, 'Private sibling content\n');
  await symlink(sibling, path.join(directory, 'linked.md'));
  const singleServer = await createOutlinerServer(selected, { webRoot });
  await new Promise(resolve => singleServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => singleServer.close(resolve)));
  const singleOrigin = `http://127.0.0.1:${singleServer.address().port}`;
  const config = configOf(await (await fetch(singleOrigin)).text());
  assert.equal(config.initialFile, 'TODO.md');
  const singleToken = config.token;
  assert.deepEqual(await (await fetch(`${singleOrigin}/api/files`)).json(), ['TODO.md']);
  const loaded = await (await fetch(`${singleOrigin}/api/file?path=TODO.md`)).json();
  assert.equal(loaded.text, '# TODO\n\n- [ ] Draft\n');
  const changed = '# TODO\n\n- [x] Draft\n';
  const saved = await fetch(`${singleOrigin}/api/file?path=TODO.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': singleToken },
    body: JSON.stringify({ text: changed, revision: loaded.revision })
  });
  assert.equal(saved.status, 200);
  assert.equal(await readFile(selected, 'utf8'), changed);

  for (const file of ['private.md', 'linked.md', '../private.md', './TODO.md']) {
    const url = `${singleOrigin}/api/file?path=${encodeURIComponent(file)}`;
    const deniedRead = await fetch(url);
    assert.equal(deniedRead.status, 403);
    assert.doesNotMatch(await deniedRead.text(), /Private sibling content/);
    const deniedSave = await fetch(url, {
      method: 'PUT', headers: { 'X-Outliner-Token': singleToken },
      body: JSON.stringify({ text: 'Unexpected edit\n', revision: loaded.revision })
    });
    assert.equal(deniedSave.status, 403);
  }
  assert.equal(await readFile(sibling, 'utf8'), 'Private sibling content\n');
  assert.equal(await readFile(selected, 'utf8'), changed);
  assert.equal(config.canCreate, false);
  assert.equal((await create(singleOrigin, 'new.md', 'new\n', singleToken)).status, 403);
  await assert.rejects(readFile(path.join(directory, 'new.md'), 'utf8'));
  const deniedRename = await renameRequest(singleOrigin, 'TODO.md', 'DONE.md', singleToken);
  assert.equal(deniedRename.status, 403);
  assert.deepEqual(await deniedRename.json(), { code: 'renameInSingleFile' });
  assert.equal(await readFile(selected, 'utf8'), changed);

  await rename(selected, path.join(directory, 'original.md'));
  await symlink(sibling, selected);
  assert.equal((await fetch(`${singleOrigin}/api/file?path=TODO.md`)).status, 403);
  const deniedReplacementSave = await fetch(`${singleOrigin}/api/file?path=TODO.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': singleToken },
    body: JSON.stringify({ text: 'Unexpected edit\n', revision: loaded.revision })
  });
  assert.equal(deniedReplacementSave.status, 403);
  assert.equal(await readFile(sibling, 'utf8'), 'Private sibling content\n');
});
