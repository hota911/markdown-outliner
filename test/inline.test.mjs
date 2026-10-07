import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInline } from '../src/ui/inline.ts';

// Compact form of the parsed tree: strings for text, [kind, ...] for the rest.
const shape = nodes => nodes.map(node => {
  if (node.kind === 'text') return node.text;
  if (node.kind === 'code') return ['code', node.text];
  if (node.kind === 'tag') return ['tag', node.tag];
  if (node.kind === 'link') return ['link', node.href, ...shape(node.children)];
  return [node.kind, ...shape(node.children)];
});
const parsed = source => {
  const nodes = parseInline(source);
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
