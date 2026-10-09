// The operations timed by the performance checks, and how they are timed. test/perf.test.mjs and
// scripts/perf-compare.mjs time them with timeOperation(), which runs this file for one operation:
//
//   node --expose-gc test/perf-operations.mjs <operation index> <items>
//
// prints the median time of that operation on largeOutline(items) in milliseconds.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as core from '../src/core.ts';
import { merge3 } from '../src/three-way-merge.ts';
import { RowKeys } from '../src/ui/keys.ts';
import { matchRanges, rowMatches } from '../src/ui/filter.ts';
import { largeOutline } from './large-outline.ts';

// Items in the smaller file; the larger has twice as many, about 2MB, the largest file expected.
export const N = 17_000;
const WARMUP = 2;
const RUNS = 7;

// Every timed run adds its result here, so the work cannot be optimized away.
let sink = 0;
const consume = value => { sink += typeof value === 'string' ? value.length : value ? 1 : 0; };

// Median time of `run` in milliseconds after warming up the JIT, collecting garbage before each
// run when node runs with --expose-gc, so that one run's garbage is not collected in the next.
function measure(run) {
  for (let index = 0; index < WARMUP; index++) consume(run());
  const times = [];
  for (let index = 0; index < RUNS; index++) {
    globalThis.gc?.();
    const start = performance.now();
    consume(run());
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
}

// The 7th item of the section at `fraction` of the file, which has a previous sibling. Every
// item of largeOutline() is a row, so item `i` is row `i`.
function itemAt(text, fraction) {
  const rows = core.parse(text);
  return rows[Math.floor(rows.length * fraction / 50) * 50 + 6];
}

const filter = query => text => {
  const rows = core.parse(text);
  return () => {
    const matches = rows.filter(row => rowMatches(row, query));
    assert.ok(matches.length > 0);
    return matches.reduce((count, row) => count + matchRanges(row.title, query).length, 0);
  };
};

// `prepare` gets the text of a file and returns the operation to time on it, which returns its
// result.
export const operations = [
  { name: 'open: parse the file and key its rows', prepare: text => () => new RowKeys().rows('large.md', text).length },
  {
    name: 'type: change a title, as every keystroke does',
    prepare: text => {
      const keys = new RowKeys();
      const row = itemAt(text, 0.5);
      let current = text, count = 0;
      keys.rows('large.md', current);
      return () => {
        current = core.updateTitle(current, row.line, row.title + ' ' + count++).text;
        return keys.rows('large.md', current).length;
      };
    },
  },
  {
    name: 'indent and move an item',
    prepare: text => {
      const row = itemAt(text, 0.5);
      return () => {
        const indented = core.indent(text, row.line).text, moved = core.move(text, row.line, 'up').text;
        assert.notEqual(indented, text);
        assert.notEqual(moved, text);
        return indented.length + moved.length;
      };
    },
  },
  {
    name: 'merge an external change into unsaved input',
    prepare: text => {
      const row = itemAt(text, 0.5), later = itemAt(text, 0.75);
      const ours = core.updateTitle(text, row.line, 'typed here').text;
      const theirs = core.insert(text, later.line, { status: 'todo', tags: ['external'] }).text;
      return () => {
        const merged = merge3(text, ours, theirs);
        assert.equal(merged.conflicts.length, 0);
        const keys = new RowKeys();
        keys.rows('large.md', ours);
        return keys.rows('large.md', merged.text('ours')).length;
      };
    },
  },
  {
    name: 'resolve a conflict',
    prepare: text => {
      const row = itemAt(text, 0.5);
      const ours = core.updateTitle(text, row.line, 'typed here').text;
      const theirs = core.updateTitle(text, row.line, 'changed elsewhere').text;
      return () => {
        const merged = merge3(text, ours, theirs);
        assert.equal(merged.conflicts.length, 1);
        return merged.text('theirs');
      };
    },
  },
  { name: 'filter by words', prepare: filter({ status: 'all', text: 'update the', tags: [] }) },
  { name: 'filter by a tag', prepare: filter({ status: 'all', text: '', tags: ['errand'] }) },
  { name: 'filter by a status', prepare: filter({ status: 'in-progress', text: '', tags: [] }) },
];

// Median time in milliseconds of operation `index` on largeOutline(items), measured in a process
// of its own: timed one after another in one process, the operations disturbed each other's
// timings (heap and JIT state), and the same operation varied by up to 40% between runs.
// `file` is this file in the checkout to measure.
export function timeOperation(index, items, file = import.meta.filename) {
  const output = execFileSync(process.execPath, ['--expose-gc', file, String(index), String(items)], { encoding: 'utf8' });
  return JSON.parse(output).ms;
}

if (import.meta.main) {
  const [index, items] = process.argv.slice(2).map(Number);
  const operation = operations[index];
  if (!operation || !Number.isInteger(items)) throw new Error('usage: node --expose-gc test/perf-operations.mjs <operation index> <items>');
  const ms = measure(operation.prepare(largeOutline(items)));
  process.stdout.write(JSON.stringify({ name: operation.name, ms, sink }) + '\n');
}
