import test from 'node:test';
import assert from 'node:assert/strict';
import { changeEstimate } from '../src/ui/estimate.ts';
import { linkAt, parseInline } from '../src/ui/inline.ts';
import { isMarkdownLink, linkCandidates, resolveLink } from '../src/ui/links.ts';

// Compact form of the parsed tree: strings for text, [kind, ...] for the rest.
const shape = nodes => nodes.map(node => {
  if (node.kind === 'text') return node.text;
  if (node.kind === 'code') return ['code', node.text];
  if (node.kind === 'tag') return ['tag', node.tag];
  if (node.kind === 'meta') return ['meta', node.meta, node.label];
  if (node.kind === 'link') return ['link', node.href, ...shape(node.children)];
  return [node.kind, ...shape(node.children)];
});
const parsed = (source, files = false) => {
  const nodes = parseInline(source, files);
  return nodes && shape(nodes);
};

test('plain text has no inline Markdown', () => {
  assert.equal(parseInline('just text with a * star and snake_case_name'), null);
});

test('each inline syntax', () => {
  assert.deepEqual(parsed('a **b** *c* _d_ `e` ~~f~~'), ['a ', ['strong', 'b'], ' ', ['em', 'c'], ' ', ['em', 'd'], ' ', ['code', 'e'], ' ', ['del', 'f']]);
  assert.deepEqual(parsed('[docs](https://example.com/a) [mail](mailto:me@example.com)'), [
    ['link', 'https://example.com/a', 'docs'], ' ', ['link', 'mailto:me@example.com', 'mail'],
  ]);
});

test('bare URLs end before trailing punctuation and non-ASCII text', () => {
  assert.deepEqual(parsed('see https://example.com/x?a=1. or (http://example.org/p_(q))を参照'), [
    'see ', ['link', 'https://example.com/x?a=1', 'https://example.com/x?a=1'], '. or (',
    ['link', 'http://example.org/p_(q)', 'http://example.org/p_(q)'], ')を参照',
  ]);
});

test('only http, https and mailto targets become links', () => {
  assert.equal(parseInline('[bad](javascript:alert(1)) [file](ftp://example.net)'), null);
  assert.equal(parseInline('javascript:alert(1)'), null);
});

test('emphasis nests inside links and links inside emphasis, but not links inside links', () => {
  assert.deepEqual(parsed('**see [the *docs*](https://example.com)**'), [
    ['strong', 'see ', ['link', 'https://example.com', 'the ', ['em', 'docs']]],
  ]);
  assert.deepEqual(parsed('[https://a.example](https://b.example)'), [['link', 'https://b.example', 'https://a.example']]);
});

test('code spans keep their content literally', () => {
  assert.deepEqual(parsed('`**x** https://example.com`'), [['code', '**x** https://example.com']]);
});

test('text and code leaves know their offset in the source', () => {
  const nodes = parseInline('a **b `c`** _d_\ne');
  const leaves = [];
  const walk = list => list.forEach(node => ('children' in node ? walk(node.children) : leaves.push([node.text, node.start])));
  walk(nodes);
  assert.deepEqual(leaves, [['a ', 0], ['b ', 4], ['c', 7], [' ', 11], ['d', 13], ['\ne', 15]]);
});

test('whole-word tags become tag nodes, also inside emphasis', () => {
  assert.deepEqual(parsed('#work plan #home'), [['tag', 'work'], ' plan ', ['tag', 'home']]);
  assert.deepEqual(parsed('**fix #bug now** and #日本語'), [['strong', 'fix ', ['tag', 'bug'], ' now'], ' and ', ['tag', '日本語']]);
  assert.deepEqual(parseInline('a\n#b c'), [
    { kind: 'text', text: 'a\n', start: 0 }, { kind: 'tag', tag: 'b', text: '#b', start: 2 }, { kind: 'text', text: ' c', start: 4 },
  ]);
});

test('words that the search box would not treat as a tag stay text', () => {
  // The whole word is `**#bug**`, `#bug**` or `a#b`, so none of them is the tag the text shows.
  assert.equal(parseInline('a#b c##d'), null);
  assert.deepEqual(parsed('**#bug**'), [['strong', '#bug']]);
  assert.deepEqual(parsed('**fix #bug**'), [['strong', 'fix #bug']]);
  assert.deepEqual(parsed('`#code` [#label](https://example.com) https://example.com/#anchor'), [
    ['code', '#code'], ' ', ['link', 'https://example.com', '#label'], ' ', ['link', 'https://example.com/#anchor', 'https://example.com/#anchor'],
  ]);
});

test('Tasks and pomodoro-timer fields become meta nodes', () => {
  assert.deepEqual(parsed('Misc [🍅:: 3] 🔁 every day ^tlot'), ['Misc ', ['meta', 'pomodoro', '🍅 3'], ' ', ['meta', 'recurrence', '🔁 every day'], ' ', ['meta', 'block', '^tlot']]);
  assert.deepEqual(parsed('a [🍅:: 0/1] 📅 2026-10-15 ✅ 2026-10-14 #home'), [
    'a ', ['meta', 'pomodoro', '🍅 0/1'], ' ', ['meta', 'date', '📅 2026-10-15'], ' ', ['meta', 'date', '✅ 2026-10-14'], ' ', ['tag', 'home'],
  ]);
  assert.deepEqual(parsed('[🍅::]'), [['meta', 'pomodoro', '🍅 0']]);
});

test('meta nodes keep their source and its offset', () => {
  assert.deepEqual(parseInline('x [🍅:: 1/2] ^ab-1'), [
    { kind: 'text', text: 'x ', start: 0 },
    { kind: 'meta', meta: 'pomodoro', label: '🍅 1/2', text: '[🍅:: 1/2]', start: 2 },
    { kind: 'text', text: ' ', start: 12 },
    { kind: 'meta', meta: 'block', label: '^ab-1', text: '^ab-1', start: 13 },
  ]);
});

test('meta fields stay text inside code and a block ID only counts at the end', () => {
  assert.deepEqual(parsed('`[🍅:: 1]` a'), [['code', '[🍅:: 1]'], ' a']);
  assert.equal(parseInline('x^2 and ^id in the middle'), null);
});

test('links to files become links only when the host can open them', () => {
  const source = '[会議支援アプリ](experiments/2026-10-05-meeting-assistant/README.md)';
  assert.equal(parseInline(source), null);
  const [link] = parseInline(source, true);
  assert.equal(link.kind, 'link');
  assert.equal(link.href, 'experiments/2026-10-05-meeting-assistant/README.md');
  assert.deepEqual(link.file, { path: 'experiments/2026-10-05-meeting-assistant/README.md', subpath: '' });
  assert.deepEqual(shape(link.children), ['会議支援アプリ']);
  // External links stay links without a file.
  assert.equal(parseInline('[docs](https://example.com)', true)[0].file, undefined);
});

test('file link targets are URL-decoded, may be written in angle brackets and keep a #heading', () => {
  const target = source => parseInline(source, true)[0].file;
  assert.deepEqual(target('[a](notes/my%20plan.md)'), { path: 'notes/my plan.md', subpath: '' });
  assert.deepEqual(target('[a](<my notes/plan B.md>)'), { path: 'my notes/plan B.md', subpath: '' });
  assert.deepEqual(target('[a](../plan.md#Next%20steps)'), { path: '../plan.md', subpath: '#Next steps' });
  assert.deepEqual(target('[a](</plan b.md#Goals>)'), { path: '/plan b.md', subpath: '#Goals' });
  assert.deepEqual(target('[a](bad%zz.md)'), { path: 'bad%zz.md', subpath: '' });
  assert.deepEqual(target('[a](<https://example.com/a b>)'), undefined);
});

test('other link targets stay text, also when files can be opened', () => {
  for (const source of ['[a](javascript:alert(1))', '[a](ftp://example.net)', '[a](//example.com/x)', '[a](#heading)', '[a](a b.md)', '[a](C:/x.md)']) {
    assert.equal(parseInline(source, true), null, source);
  }
});

test('file links keep emphasis, tags and text around them', () => {
  assert.deepEqual(parsed('see [**plan**](plan.md) #work', true), ['see ', ['link', 'plan.md', ['strong', 'plan']], ' ', ['tag', 'work']]);
  assert.deepEqual(parsed('`[a](b.md)` and [c](d.md)', true), [['code', '[a](b.md)'], ' and ', ['link', 'd.md', 'c']]);
});

test('linkAt finds the link around an offset of the source', () => {
  const nodes = parseInline('x [a **b**](plan.md) y', true);
  assert.equal(linkAt(nodes, 1), null);
  assert.equal(linkAt(nodes, 2).file.path, 'plan.md');
  assert.equal(linkAt(nodes, 8).file.path, 'plan.md');
  assert.equal(linkAt(nodes, 19).file.path, 'plan.md');
  assert.equal(linkAt(nodes, 21), null);
});

test('links resolve from the folder of the file containing them, then from the root', () => {
  const files = ['README.md', 'notes/plan.md', 'notes/README.md', 'archive/old.md', 'my notes/a b.md'];
  const link = (path, source = 'notes/today.md') => ({ path, subpath: '', source });
  assert.deepEqual(linkCandidates(link('plan.md')), ['notes/plan.md', 'plan.md']);
  assert.deepEqual(linkCandidates(link('../archive/old')), ['archive/old.md']);
  assert.deepEqual(linkCandidates(link('/README.md')), ['README.md']);
  assert.equal(resolveLink(link('plan.md'), files), 'notes/plan.md');
  assert.equal(resolveLink(link('README.md'), files), 'notes/README.md');
  assert.equal(resolveLink(link('README.md', 'today.md'), files), 'README.md');
  assert.equal(resolveLink(link('archive/old.md'), files), 'archive/old.md');
  assert.equal(resolveLink(link('../archive/old'), files), 'archive/old.md');
  assert.equal(resolveLink(link('/README.md'), files), 'README.md');
  assert.equal(resolveLink(link('my notes/a b.md', 'x.md'), files), 'my notes/a b.md');
  // A bare file name also finds the file in another folder, as with "Shortest path when possible".
  assert.equal(resolveLink(link('old.md'), files), 'archive/old.md');
  assert.equal(resolveLink(link('../../README.md'), files), null);
  assert.equal(resolveLink(link('missing.md'), files), null);
  assert.equal(isMarkdownLink(link('plan')), true);
  assert.equal(isMarkdownLink(link('a/README.MD')), true);
  assert.equal(isMarkdownLink(link('slides.pdf')), false);
});

test('changes the pomodoro estimate of a title by one', () => {
  assert.equal(changeEstimate('Plan', 1), 'Plan [🍅:: 0/1]');
  assert.equal(changeEstimate('Plan ^abc', 1), 'Plan [🍅:: 0/1] ^abc');
  assert.equal(changeEstimate('Plan [🍅:: 1/2] #work', 1), 'Plan [🍅:: 1/3] #work');
  assert.equal(changeEstimate('Plan [🍅:: 3]', 1), 'Plan [🍅:: 3/1]');
  assert.equal(changeEstimate('Plan [🍅:: 1/2]', -1), 'Plan [🍅:: 1/1]');
  assert.equal(changeEstimate('Plan [🍅:: 2/1]', -1), 'Plan [🍅:: 2]');
  assert.equal(changeEstimate('Plan [🍅:: 0/1] ^id', -1), 'Plan ^id');
  assert.equal(changeEstimate('Plan', -1), 'Plan');
});
