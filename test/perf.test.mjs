// Performance checks on large files, run with `npm run test:perf` (separately from `npm test`, so
// that other test files running in parallel do not disturb the timings).
//
// Each operation of test/perf-operations.mjs is timed on an outline of N items and of 2N items.
// Machines differ in speed, so the main check is how the time grows: a linear operation takes
// about twice as long on twice the file, a quadratic one four times. The absolute budget only
// catches an operation that became far too slow on any machine.
//
// With PERF_RESULTS set to a path, the medians are also written there in the format of
// github-action-benchmark's customSmallerIsBetter tool, which records them for each commit to
// main (.github/workflows/perf.yml).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { N, operations, timeOperation } from './perf-operations.mjs';

const MAX_RATIO = 3;
const BUDGET_MS = 1000;

const results = [];

operations.forEach(({ name }, index) => {
  test(name, t => {
    const small = timeOperation(index, N), large = timeOperation(index, 2 * N);
    results.push({ name: `${name} (${N} items)`, unit: 'ms', value: small }, { name: `${name} (${2 * N} items)`, unit: 'ms', value: large });
    const ratio = large / small;
    t.diagnostic(`${name}: ${small.toFixed(1)}ms at ${N} items, ${large.toFixed(1)}ms at ${2 * N} items, ratio ${ratio.toFixed(2)}`);
    assert.ok(ratio < MAX_RATIO, `twice the file took ${ratio.toFixed(2)} times as long (limit ${MAX_RATIO})`);
    assert.ok(large < BUDGET_MS, `took ${large.toFixed(0)}ms on the largest file (limit ${BUDGET_MS}ms)`);
  });
});

after(() => {
  if (process.env.PERF_RESULTS) writeFileSync(process.env.PERF_RESULTS, JSON.stringify(results, null, 2) + '\n');
});
