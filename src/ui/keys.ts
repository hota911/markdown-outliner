import { parse, type Row } from '../core.ts';

export interface KeyedRow extends Row {
  key: string;
}

// LCS tables above this many cells are skipped; content matching still pairs moved lines.
const LCS_LIMIT = 1_000_000;

// Maps old line indexes to new line indexes. Equal lines are matched first (ignoring indentation,
// so indent and outdent keep identity), then edited lines are paired by position between matches.
export function mapLines(before: string[], after: string[]): Map<number, number> {
  const mapping = new Map<number, number>();
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    mapping.set(start, start);
    start++;
  }
  let endBefore = before.length, endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--;
    endAfter--;
    mapping.set(endBefore, endAfter);
  }
  const oldLines = before.slice(start, endBefore).map(line => line.trim());
  const newLines = after.slice(start, endAfter).map(line => line.trim());
  const pairs: [number, number][] = [];
  if (oldLines.length * newLines.length <= LCS_LIMIT) {
    // Longest common subsequence keeps the relative order of unchanged lines.
    const table = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1));
    for (let i = oldLines.length - 1; i >= 0; i--) {
      for (let j = newLines.length - 1; j >= 0; j--) {
        table[i][j] = oldLines[i] === newLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    for (let i = 0, j = 0; i < oldLines.length && j < newLines.length;) {
      if (oldLines[i] === newLines[j]) { pairs.push([i, j]); i++; j++; }
      else if (table[i + 1][j] >= table[i][j + 1]) i++;
      else j++;
    }
  }
  const usedOld = new Set(pairs.map(([i]) => i));
  const usedNew = new Set(pairs.map(([, j]) => j));
  // Lines moved past others (Alt+arrow, drag and drop) keep identity when their content is unique.
  const unmatchedOld = new Map<string, number[]>();
  oldLines.forEach((line, i) => {
    if (usedOld.has(i)) return;
    const list = unmatchedOld.get(line) ?? [];
    list.push(i);
    unmatchedOld.set(line, list);
  });
  newLines.forEach((line, j) => {
    if (usedNew.has(j)) return;
    const i = unmatchedOld.get(line)?.shift();
    if (i === undefined) return;
    pairs.push([i, j]);
    usedOld.add(i);
    usedNew.add(j);
  });
  // Edited lines are paired in order between neighbouring matches.
  const anchors = pairs.filter(([i]) => usedOld.has(i)).sort((a, b) => a[0] - b[0]);
  let previousOld = -1, previousNew = -1;
  for (const [nextOld, nextNew] of [...anchors, [oldLines.length, newLines.length] as [number, number]]) {
    if (nextNew > previousNew) {
      let j = previousNew + 1;
      for (let i = previousOld + 1; i < nextOld; i++) {
        if (usedOld.has(i)) continue;
        while (j < nextNew && usedNew.has(j)) j++;
        if (j >= nextNew) break;
        pairs.push([i, j]);
        usedOld.add(i);
        usedNew.add(j);
        j++;
      }
      previousNew = nextNew;
    }
    previousOld = Math.max(previousOld, nextOld);
  }
  for (const [i, j] of pairs) mapping.set(start + i, start + j);
  return mapping;
}

// Gives each row a key that survives edits, so keyed rendering keeps the DOM node (and focus)
// of a row while lines are inserted, removed or moved around it.
export class RowKeys {
  private readonly cache = new Map<string, { text: string; rows: KeyedRow[] }>();
  private next = 0;

  rows(path: string, text: string): KeyedRow[] {
    const cached = this.cache.get(path);
    if (cached && cached.text === text) return cached.rows;
    const rows = parse(text);
    const previous = new Map<number, string>();
    if (cached) {
      const mapping = mapLines(cached.text.split('\n'), text.split('\n'));
      for (const row of cached.rows) {
        const line = mapping.get(row.line);
        if (line !== undefined) previous.set(line, row.key);
      }
    }
    const used = new Set<string>();
    const keyed = rows.map(row => {
      let key = previous.get(row.line);
      if (key === undefined || used.has(key)) key = 'row-' + this.next++;
      used.add(key);
      return { ...row, key };
    });
    this.cache.set(path, { text, rows: keyed });
    return keyed;
  }
}
