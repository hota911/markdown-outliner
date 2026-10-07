import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOutlinerServer } from '../server.mjs';

let server, workspace, origin, token;
before(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-test-'));
  await writeFile(path.join(workspace, 'tasks.md'), '# Tasks\n\n- [ ] Draft #work\n');
  await writeFile(path.join(workspace, 'work.md'), '- [/] Embedded #work\n');
  server = await createOutlinerServer(workspace);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(origin)).text();
  token = html.match(/'X-Outliner-Token': '([a-f0-9]+)'/)[1];
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

test('serves the shared UI assets', async () => {
  for (const asset of ['/core.js', '/ui.js', '/styles.css']) {
    assert.equal((await fetch(origin + asset)).status, 200);
  }
});

test('returns explicit errors for missing Markdown and invalid requests', async () => {
  assert.equal((await fetch(`${origin}/api/file?path=missing.md`)).status, 404);
  assert.equal((await fetch(`${origin}/api/file?path=server.mjs`)).status, 400);
  const response = await fetch(`${origin}/api/file?path=work.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': token }, body: 'not JSON'
  });
  assert.equal(response.status, 400);
  const nullBody = await fetch(`${origin}/api/file?path=work.md`, {
    method: 'PUT', headers: { 'X-Outliner-Token': token }, body: 'null'
  });
  assert.equal(nullBody.status, 400);
});

test('single-file mode lists, reads and saves only the selected Markdown file', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'markdown-outliner-single-'));
  const selected = path.join(directory, 'TODO.md');
  const sibling = path.join(directory, 'private.md');
  await writeFile(selected, '# TODO\n\n- [ ] Draft\n');
  await writeFile(sibling, 'Private sibling content\n');
  await symlink(sibling, path.join(directory, 'linked.md'));
  const singleServer = await createOutlinerServer(selected);
  await new Promise(resolve => singleServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => singleServer.close(resolve)));
  const singleOrigin = `http://127.0.0.1:${singleServer.address().port}`;
  const html = await (await fetch(singleOrigin)).text();
  assert.match(html, /initialFile: "TODO\.md"/);
  const singleToken = html.match(/'X-Outliner-Token': '([a-f0-9]+)'/)[1];
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
  assert.doesNotMatch(html, /create:/);
  assert.equal((await create(singleOrigin, 'new.md', 'new\n', singleToken)).status, 403);
  await assert.rejects(readFile(path.join(directory, 'new.md'), 'utf8'));

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
