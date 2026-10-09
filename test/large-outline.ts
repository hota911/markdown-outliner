// A large, deterministic outline for the performance checks (test/perf.test.mjs and
// e2e/large-file.spec.ts): sections of nested tasks and bullets up to four levels deep, with
// every status, notes, #tags and links. Item `i` is titled `item i ...`, so a test can find it.

const statuses = [' ', '/', 'x', ' ', 'x'];
const tags = ['#work', '#home', '#priority/high', '#errand', '#reading'];
const words = ['review the draft', 'call back', 'update the plan', 'fix the bug', 'buy groceries', 'write notes'];

// Each section of 50 items is a top-level item, then runs that go down four levels and back up.
const depths = [1, 2, 3, 4, 2, 1];
const depthOf = (i: number) => (i % 50 === 0 ? 0 : depths[(i % 50 - 1) % depths.length]);

export function largeOutline(items: number): string {
  const lines = ['# Large outline', ''];
  for (let i = 0; i < items; i++) {
    const depth = depthOf(i);
    const indent = '  '.repeat(depth);
    const task = i % 6 !== 5;
    const link = i % 9 === 0 ? ' see [notes](https://example.com/' + i + ')' : '';
    lines.push(indent + '- ' + (task ? '[' + statuses[i % statuses.length] + '] ' : '') + 'item ' + i + ' ' + words[i % words.length] + link + ' ' + tags[i % tags.length]);
    if (i % 4 === 0) lines.push(indent + '  A note for item ' + i + ' with a ' + tags[(i + 2) % tags.length] + ' tag.');
  }
  return lines.join('\n') + '\n';
}
