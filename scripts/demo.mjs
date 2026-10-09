// Serves a throwaway copy of samples/ (or of the folder or Markdown file given as the first
// argument), so a demo never edits the originals. Usage: npm run demo -- [folder-or-file] [port]
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutlinerServer } from '../server.mjs';

const source = path.resolve(process.argv[2] || fileURLToPath(new URL('../samples', import.meta.url)));
const port = Number(process.argv[3] || 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');

const copy = path.join(await mkdtemp(path.join(tmpdir(), 'markdown-outliner-demo-')), path.basename(source));
await cp(source, copy, { recursive: true });
const server = await createOutlinerServer(copy);
server.listen(port, '127.0.0.1', () => {
  console.log(`Editing a copy of ${source} at ${copy}`);
  console.log(`Markdown outliner: http://127.0.0.1:${server.address().port}`);
});
