// Compares the speed of this checkout with a checkout of the base commit on the same machine, for
// pull requests (.github/workflows/perf.yml). Usage:
//
//   node scripts/perf-compare.mjs <base checkout> [report.md]
//
// Copies this checkout's test/perf-operations.mjs and test/large-outline.ts into the base
// checkout, so both sides run the same benchmark code against their own src/. Then times each
// operation on the larger test file ROUNDS times on each side, alternating base and head so that
// a machine getting slower or faster during the job affects both alike. Writes a Markdown report
// (also to $GITHUB_STEP_SUMMARY) and `status=ok|warning|fail` to $GITHUB_OUTPUT.
//
// Timings on shared CI runners vary from run to run, which is why both sides are measured in the
// same job instead of against an earlier job's numbers.
import { copyFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { N, operations, timeOperation } from '../test/perf-operations.mjs';

// The two lines. An operation is reported when the head's median time is at least WARNING_RATIO
// times the base's, and fails the job at FAILING_RATIO times, in both cases only when the
// difference is also significant (below). See "Performance" in README.md for how they were chosen.
const WARNING_RATIO = 1.3;
const FAILING_RATIO = 2;
// Times each side runs each operation, in a process of its own.
const ROUNDS = 6;
// Significance level for the whole report, split over the operations (Bonferroni correction),
// since testing eight operations at 5% each would flag one by chance about a third of the time.
const ALPHA = 0.05;

const ITEMS = 2 * N;
const MARKER = '<!-- perf-compare -->';

const [baseDir, reportPath] = process.argv.slice(2);
if (!baseDir) throw new Error('usage: node scripts/perf-compare.mjs <base checkout> [report.md]');
const headDir = path.resolve(import.meta.dirname, '..');
for (const file of ['test/perf-operations.mjs', 'test/large-outline.ts']) copyFileSync(path.join(headDir, file), path.join(baseDir, file));
const baseFile = path.resolve(baseDir, 'test/perf-operations.mjs');

const commit = dir => execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// One-sided p-value of the Mann-Whitney U test that `head` tends to be slower than `base`: the
// chance that, with no difference, U (pairs where head is faster, ties counting half) is this
// small. Exact, by counting the orderings of the two samples that give each U.
function slowerPValue(base, head) {
  let u = 0;
  for (const h of head) for (const b of base) u += h < b ? 1 : h === b ? 0.5 : 0;
  // counts[m][n][k]: orderings of m base and n head values with U = k.
  const m = base.length, n = head.length;
  const counts = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => []));
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      for (let k = 0; k <= i * j; k++) {
        counts[i][j][k] = i === 0 || j === 0 ? (k === 0 ? 1 : 0)
          // The largest value is a base value (adding j pairs where head is faster) or a head value.
          : (k >= j ? counts[i - 1][j][k - j] : 0) + (counts[i][j - 1][k] ?? 0);
      }
    }
  }
  const all = counts[m][n];
  const total = all.reduce((sum, count) => sum + count, 0);
  // Rounding a tie's half up keeps the test conservative.
  return all.slice(0, Math.ceil(u) + 1).reduce((sum, count) => sum + count, 0) / total;
}

const rows = operations.map(({ name }, index) => {
  const base = [], head = [];
  let baseError = null;
  for (let round = 0; round < ROUNDS; round++) {
    const order = round % 2 ? ['head', 'base'] : ['base', 'head'];
    for (const side of order) {
      if (side === 'head') head.push(timeOperation(index, ITEMS));
      else if (!baseError) {
        // The base may lack what the operation uses, e.g. when the pull request adds the function
        // being timed; then there is nothing to compare with.
        try { base.push(timeOperation(index, ITEMS, baseFile)); } catch (error) { baseError = error; }
      }
    }
  }
  if (baseError) {
    console.error(`${name}: could not run on the base commit`, baseError.message);
    return { name, head: median(head), status: 'no base' };
  }
  const ratio = median(head) / median(base);
  const p = slowerPValue(base, head);
  const significant = p < ALPHA / operations.length;
  const status = significant && ratio >= FAILING_RATIO ? 'fail' : significant && ratio >= WARNING_RATIO ? 'warning' : 'ok';
  return { name, base: median(base), head: median(head), ratio, p, status };
});

const status = rows.some(row => row.status === 'fail') ? 'fail' : rows.some(row => row.status === 'warning') ? 'warning' : 'ok';
const label = { ok: 'ok', warning: 'slower (warning)', fail: 'much slower (failure)', 'no base': 'not on base' };
const ms = value => value === undefined ? '' : value.toFixed(1);
const report = [
  MARKER,
  `### Performance: ${{ ok: 'no regression', warning: 'warning', fail: 'failure' }[status]}`,
  '',
  `Median of ${ROUNDS} runs on a file of ${ITEMS} items, base \`${commit(baseDir)}\` and head \`${commit(headDir)}\` alternating on the same runner.`,
  `Warning at ${WARNING_RATIO}x the base, failure at ${FAILING_RATIO}x, each only when the Mann-Whitney U test gives p < ${ALPHA}/${operations.length}.`,
  '',
  '| Operation | Base (ms) | Head (ms) | Head / base | p | Result |',
  '|-|-:|-:|-:|-:|-|',
  ...rows.map(row => `| ${row.name} | ${ms(row.base)} | ${ms(row.head)} | ${row.ratio?.toFixed(2) ?? ''} | ${row.p?.toFixed(4) ?? ''} | ${label[row.status]} |`),
  '',
].join('\n');

console.log(report);
if (reportPath) writeFileSync(reportPath, report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
