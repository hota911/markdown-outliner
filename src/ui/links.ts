// Resolves links to files for hosts without Obsidian's metadata cache (the web version and the
// preview), in the order of Obsidian's getFirstLinkpathDest.
import type { Messages } from './messages.ts';
import type { Adapter, FileLink, Mounted } from './types.ts';

// A path without an extension names a Markdown file, as in Obsidian.
const named = (path: string) => /\.[^/.]+$/.test(path) ? path : path + '.md';

export const isMarkdownLink = (link: FileLink) => /\.md$/i.test(named(link.path));

// `target` from the folder `base`, or null when `..` leaves the root.
function join(base: string[], target: string): string | null {
  const parts = [...base];
  for (const part of target.split('/')) {
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

// The paths a link may point to, relative to the root: from the folder of the file containing it,
// then from the root. A path starting with `/` is from the root only.
export function linkCandidates(link: FileLink): string[] {
  const path = named(link.path);
  const folder = link.source.split('/').slice(0, -1);
  const paths = (path.startsWith('/') ? [[]] : [folder, []]).map(base => join(base, path));
  return [...new Set(paths.filter((candidate): candidate is string => candidate !== null))];
}

// The file of `files` a link points to, or null. A link of only a file name, as Obsidian writes it
// with its "Shortest path when possible" setting, also finds the file in any folder.
export function resolveLink(link: FileLink, files: string[]): string | null {
  const found = linkCandidates(link).find(candidate => files.includes(candidate));
  if (found !== undefined) return found;
  const name = named(link.path);
  return name.includes('/') ? null : files.find(file => file.endsWith('/' + name)) ?? null;
}

// Shows the Markdown file a link points to in the outliner, as choosing it in the file picker does.
export async function openMarkdownLink(link: FileLink, adapter: Adapter, mounted: Mounted, t: Messages) {
  const file = resolveLink(link, await adapter.list());
  if (file === null) throw new Error(t.link.missing);
  await mounted.openFile(file);
}
