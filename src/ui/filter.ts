import type { Row } from '../core.ts';
import type { StatusFilter } from './types.ts';

// The words and #tags typed in the search box. `text` is matched as one case-insensitive
// substring of the title; each tag must appear as a whole word in the title or the note.
export interface TextQuery { text: string; tags: string[] }
export interface FilterQuery extends TextQuery { status: StatusFilter }

export const filterActive = (query: FilterQuery) => query.status !== 'all' || !!query.text || query.tags.length > 0;

const tagWord = (tag: string) => '#' + tag;

export function rowMatches(row: Row, query: FilterQuery): boolean {
  const statusMatches = query.status === 'all' || (query.status === 'not-done' ? row.status !== 'done' : row.status === query.status);
  const words = (row.title + '\n' + row.note).split(/\s+/);
  return statusMatches && query.tags.every(tag => words.includes(tagWord(tag))) && row.title.toLowerCase().includes(query.text.toLowerCase());
}

// Ranges [start, end) of `title` that made it match `query`: every occurrence of the text and
// every whole-word #tag. Sorted and merged, so that overlapping ranges render as one mark.
export function matchRanges(title: string, query: TextQuery): [number, number][] {
  const ranges: [number, number][] = [];
  const lower = title.toLowerCase();
  // Lowercasing can change the length of a few characters (such as 'İ'); offsets into the
  // lowercased title would then be wrong, so the text is not marked in such a title.
  if (query.text && lower.length === title.length) {
    const needle = query.text.toLowerCase();
    for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, index + needle.length)) {
      ranges.push([index, index + needle.length]);
    }
  }
  const tags = new Set(query.tags.map(tagWord));
  for (const word of title.matchAll(/\S+/g)) {
    if (tags.has(word[0])) ranges.push([word.index, word.index + word[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

// `start` is the offset of the piece in the title, like the start of the part it was split from.
export interface Piece { text: string; start: number; mark: boolean }

// Splits `text`, which starts at offset `start` of the title, into marked and unmarked pieces.
export function markPieces(text: string, start: number, ranges: [number, number][]): Piece[] {
  const pieces: Piece[] = [];
  let position = 0;
  for (const [from, to] of ranges) {
    const begin = Math.max(from - start, position), end = Math.min(to - start, text.length);
    if (begin >= end) continue;
    if (begin > position) pieces.push({ text: text.slice(position, begin), start: start + position, mark: false });
    pieces.push({ text: text.slice(begin, end), start: start + begin, mark: true });
    position = end;
  }
  if (position < text.length) pieces.push({ text: text.slice(position), start: start + position, mark: false });
  return pieces;
}
