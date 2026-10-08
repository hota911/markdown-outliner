import type { Row } from '../core.ts';
import { messages, type Messages } from './messages.ts';

export type SlashCommand = keyof Messages['slash']['command'];
// The `/` or `#` menu of a title. `start` is the offset of the `/` or `#`, and the text after it up
// to the caret is `query`. The 'files' step lists the files to embed, filtered by the same query.
// The 'tags' step, opened by `#`, lists the tags in use (`tags`, sorted).
export interface Slash { path: string; line: number; start: number; query: string; step: 'commands' | 'files' | 'tags'; index: number; files: string[]; tags: string[] }
export interface SlashOption { id: string; label: string }

// Folds text for matching commands: full-width and half-width forms (NFKC), case, and katakana to
// hiragana, so `ノート`, `のーと` and `ﾉｰﾄ` match each other.
function foldKana(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export const trigger = (slash: Slash) => slash.step === 'tags' ? '#' : '/';
export const sortTags = (tags: Iterable<string>) => [...new Set(tags)].sort((a, b) => a.localeCompare(b));

// The path of `target` relative to the folder of `from`, as embeds are written (see normalize).
export function relativePath(from: string, target: string) {
  const folder = from.split('/').slice(0, -1), parts = target.split('/');
  let common = 0;
  while (common < folder.length && common < parts.length - 1 && folder[common] === parts[common]) common++;
  return [...folder.slice(common).map(() => '..'), ...parts.slice(common)].join('/');
}

// Tags starting with the query come first, then the ones containing it, each alphabetically.
export function tagOptions(query: string, tags: string[]): SlashOption[] {
  const folded = foldKana(query);
  const candidates = tags.map(tag => ({ tag, folded: foldKana(tag) }));
  const matches = [
    ...candidates.filter(candidate => candidate.folded.startsWith(folded)),
    ...candidates.filter(candidate => !candidate.folded.startsWith(folded) && candidate.folded.includes(folded)),
  ].map(({ tag }) => tag);
  // A tag typed out in full is no suggestion on its own: the menu closes and Enter stays Enter.
  if (matches.length === 1 && matches[0] === query) return [];
  return matches.map(tag => ({ id: tag, label: '#' + tag }));
}

// The files to embed into `path`, other than `path` itself.
export function fileOptions(query: string, files: string[], path: string): SlashOption[] {
  const lower = query.toLowerCase();
  return files.filter(file => file !== path && file.toLowerCase().includes(lower)).map(file => ({ id: file, label: file }));
}

// The commands for a row of `kind`, matched by their English and Japanese labels and keywords.
export function commandOptions(query: string, kind: Row['kind'], zoomed: boolean, t: Messages): SlashOption[] {
  const folded = foldKana(query);
  // Status commands also turn a bullet into a task, as core.updateStatus does.
  const commands = (Object.keys(t.slash.command) as SlashCommand[]).filter(command =>
    !(command === 'task' && kind === 'task' || command === 'bullet' && kind !== 'task' || command === 'zoom' && zoomed));
  return commands
    .filter(command => [messages.en, messages.ja].some(({ slash }) => foldKana(slash.command[command].label + ' ' + slash.command[command].keywords).includes(folded)))
    .map(command => ({ id: command, label: t.slash.command[command].label }));
}
