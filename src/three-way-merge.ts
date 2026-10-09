// Line-based three-way merge of a file that was edited in this view (ours) and elsewhere (theirs)
// since both started from the same loaded text (base).
//
// Unlike diff3 as used by git, edits on neighbouring lines merge cleanly: a conflict needs both
// sides to change the same base line. Lines inserted by both sides at the same place are kept
// from both, the external lines first, because each side usually added its own new items.
//
// Lines are split on '\n' only, so '\r' of CRLF files stays part of each line and a final
// newline is an empty last line; joining with '\n' restores the text byte for byte.

export type Side = 'ours' | 'theirs';

export interface Conflict {
  base: string[];
  ours: string[];
  theirs: string[];
}

export interface MergeResult {
  conflicts: Conflict[];
  // The merged text, taking the given side in every conflict.
  text(side: Side): string;
}

// Lines of `base` in [start, end) replaced by `lines`.
interface Hunk {
  start: number;
  end: number;
  lines: string[];
  side: Side;
}

// Myers' algorithm keeps one snapshot per edit step, so memory grows with the square of the
// number of edits, not with the file size. Beyond this many edits the changed middle of the file
// is compared line by line if it kept its length, and is otherwise one block; both only make a
// conflict more likely.
const MAX_EDITS = 1000;

// Matched line pairs of a[aStart, aEnd) and b[bStart, bEnd) in ascending order, or none when the
// ranges differ in more than MAX_EDITS lines.
function commonLines(a: string[], b: string[], aStart: number, aEnd: number, bStart: number, bEnd: number): [number, number][] {
  const n = aEnd - aStart, m = bEnd - bStart;
  const max = Math.min(n + m, MAX_EDITS);
  const offset = max + 1;
  // v[offset + k] is the furthest x reached on diagonal k = x - y.
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    // trace[d][k + d] is v before step d.
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || k !== d && v[offset + k - 1] < v[offset + k + 1] ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[aStart + x] === b[bStart + y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, d, n, m).map(([i, j]) => [aStart + i, bStart + j]);
    }
  }
  return [];
}

function backtrack(trace: Int32Array[], edits: number, n: number, m: number): [number, number][] {
  const pairs: [number, number][] = [];
  let x = n, y = m;
  for (let d = edits; d > 0; d--) {
    const previous = trace[d];
    const k = x - y;
    const down = k === -d || k !== d && previous[k - 1 + d] < previous[k + 1 + d];
    const previousK = down ? k + 1 : k - 1;
    const previousX = previous[previousK + d];
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) { x--; y--; pairs.push([x, y]); }
    x = previousX;
    y = previousY;
  }
  while (x > 0 && y > 0) { x--; y--; pairs.push([x, y]); }
  return pairs.reverse();
}

// The changes from `base` to `other` as maximal hunks in ascending order.
function diff(base: string[], other: string[], side: Side): Hunk[] {
  // Most edits touch a small part of the file, so the common ends are skipped before Myers.
  let start = 0;
  while (start < base.length && start < other.length && base[start] === other[start]) start++;
  let baseEnd = base.length, otherEnd = other.length;
  while (baseEnd > start && otherEnd > start && base[baseEnd - 1] === other[otherEnd - 1]) { baseEnd--; otherEnd--; }
  const hunks: Hunk[] = [];
  let i = start, j = start;
  for (const [matchI, matchJ] of [...commonLines(base, other, start, baseEnd, start, otherEnd), [baseEnd, otherEnd]]) {
    // Consecutive lines edited in place are split into one hunk per line, so that an edit by the
    // other side to one of them conflicts only with that line.
    if (matchI - i === matchJ - j) {
      for (let offset = 0; offset < matchI - i; offset++) {
        if (base[i + offset] !== other[j + offset]) hunks.push({ start: i + offset, end: i + offset + 1, lines: [other[j + offset]], side });
      }
    } else hunks.push({ start: i, end: matchI, lines: other.slice(j, matchJ), side });
    i = matchI + 1;
    j = matchJ + 1;
  }
  return hunks;
}

// base[start, end) with the given hunks, all inside that range, applied.
function apply(base: string[], start: number, end: number, hunks: Hunk[]): string[] {
  const lines: string[] = [];
  let position = start;
  for (const hunk of hunks) {
    lines.push(...base.slice(position, hunk.start), ...hunk.lines);
    position = hunk.end;
  }
  lines.push(...base.slice(position, end));
  return lines;
}

const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((line, index) => line === b[index]);

export function merge3(baseText: string, oursText: string, theirsText: string): MergeResult {
  // TEMPORARY slowdown to check the failing line of scripts/perf-compare.mjs; reverted before merge.
  for (const until = performance.now() + 20; performance.now() < until;);
  const base = baseText.split('\n');
  const hunks = [...diff(base, oursText.split('\n'), 'ours'), ...diff(base, theirsText.split('\n'), 'theirs')]
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const chunks: (string[] | Conflict)[] = [];
  const conflicts: Conflict[] = [];
  let position = 0;
  for (let index = 0; index < hunks.length;) {
    const start = hunks[index].start;
    let end = hunks[index].end;
    const group = [hunks[index++]];
    // Hunks overlap when they share a base line, or are insertions at the same place. An insertion
    // at the edge of a replaced range does not touch its lines and stays separate.
    while (index < hunks.length && (hunks[index].start < end || hunks[index].start === start && hunks[index].end === start && end === start)) {
      end = Math.max(end, hunks[index].end);
      group.push(hunks[index++]);
    }
    chunks.push(base.slice(position, start));
    position = end;
    const ours = apply(base, start, end, group.filter(hunk => hunk.side === 'ours'));
    const theirs = apply(base, start, end, group.filter(hunk => hunk.side === 'theirs'));
    if (group.every(hunk => hunk.side === 'theirs') || sameLines(ours, theirs)) chunks.push(theirs);
    else if (group.every(hunk => hunk.side === 'ours')) chunks.push(ours);
    else if (start === end) chunks.push([...theirs, ...ours]);
    else {
      const conflict = { base: base.slice(start, end), ours, theirs };
      chunks.push(conflict);
      conflicts.push(conflict);
    }
  }
  chunks.push(base.slice(position));
  return {
    conflicts,
    text: side => chunks.flatMap(chunk => Array.isArray(chunk) ? chunk : chunk[side]).join('\n'),
  };
}
