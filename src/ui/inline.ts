// Inline Markdown shown over item titles and notes while they are not being edited.
// The result is data for the template to build DOM from; nothing here produces HTML.
import { estimateLabel, estimateOf, pomodoroField } from './estimate.ts';

// Text, code and tag leaves keep their offset in the source so that a click can put the caret
// there and filter matches can be marked in them.
export type Inline =
  | { kind: 'text' | 'code'; text: string; start: number }
  // `tag` is without the `#`; `text` is the word as typed.
  | { kind: 'tag'; tag: string; text: string; start: number }
  | { kind: 'link'; href: string; children: Inline[] }
  // A field of the Tasks or pomodoro-timer plugins, shown as a badge. `label` is what the badge
  // shows and `text` the source it stands for.
  | { kind: 'meta'; meta: Meta; label: string; text: string; start: number }
  | { kind: 'strong' | 'em' | 'del'; children: Inline[] };

export type Meta = 'pomodoro' | 'recurrence' | 'date' | 'block';

// `[🍅:: 1/3]`, Tasks' `🔁 every day` and dated fields such as `📅 2026-10-15`, and a block ID
// (`^abcd`) at the very end. The recurrence runs to its last letter or digit, as Tasks reads it.
const metaRules: { meta: Meta; pattern: RegExp; label: (match: RegExpMatchArray) => string }[] = [
  { meta: 'pomodoro', pattern: pomodoroField, label: match => estimateLabel(estimateOf(match[0])!) },
  { meta: 'recurrence', pattern: /🔁\uFE0F?[ \t]?([A-Za-z0-9, !]*[A-Za-z0-9!])/gu, label: match => '🔁 ' + match[1] },
  { meta: 'date', pattern: /([📅⏳🛫➕✅❌])\uFE0F?[ \t]?(\d{4}-\d{2}-\d{2})/gu, label: match => match[1] + ' ' + match[2] },
  // The space before the ID is captured rather than looked behind for, which iOS before 16.4 lacks.
  { meta: 'block', pattern: /(^|[ \t])(\^[A-Za-z0-9-]+)[ \t]*$/g, label: match => match[2] },
];

// Only these targets become anchors; any other Markdown link stays plain text.
const linkTarget = String.raw`(?:https?:\/\/|mailto:)[^\s)]+`;
// ASCII only, so that a URL followed directly by Japanese text ends there.
const bareUrl = String.raw`https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+`;
// Content neither starts nor ends with whitespace. No lookbehind: iOS before 16.4 lacks it.
const span = (open: string, close: string, last = String.raw`\S`) => String.raw`${open}(?!\s)([^\n]*?${last})${close}`;

// The leftmost match wins; at the same position, the earlier alternative does.
const rules = (links: boolean) => new RegExp([
  '`([^`\\n]+)`',
  links ? String.raw`\[([^\]\n]+)\]\((${linkTarget})\)` : '(?!)()()',
  links ? `(${bareUrl})` : '(?!)()',
  span(String.raw`\*\*`, String.raw`\*\*`),
  span('~~', '~~'),
  span(String.raw`\*(?!\*)`, String.raw`\*`, String.raw`[^\s*]`),
  // `snake_case_words` are not emphasis. The character before `_` is captured, not part of the emphasis.
  '(^|[^A-Za-z0-9_])' + span('_', '_(?![A-Za-z0-9_])', '[^\\s_]'),
].join('|'));
const withLinks = rules(true);
const withoutLinks = rules(false);
// A tag is a whole whitespace-separated word of the source, the same rule the search box uses, so
// clicking a tag always matches its own item. `**fix #bug**` has no tag: the word is `#bug**`.
// The leading space is captured rather than looked behind for, which iOS before 16.4 lacks.
const tagWord = /(^|\s)(#[^#\s]+)(?=\s|$)/g;

// Trailing punctuation usually ends the sentence rather than the URL.
function trimUrl(url: string) {
  for (;;) {
    const last = url[url.length - 1];
    const unbalanced = (open: string, close: string) => last === close && url.split(open).length < url.split(close).length;
    if (/[.,;:!?'"*_~]/.test(last) || unbalanced('(', ')') || unbalanced('[', ']')) url = url.slice(0, -1);
    else return url;
  }
}

// A tag or a meta field: a node for the [start, end) range of the whole source.
type Token = { start: number; end: number; node: Inline };

// `tokens` are sorted and do not overlap. A token becomes a node only where it lies within one run
// of plain text outside links.
function parse(source: string, base: number, links: boolean, tokens: Token[]): Inline[] {
  const nodes: Inline[] = [];
  const pattern = links ? withLinks : withoutLinks;
  let position = 0;
  const text = (end: number) => {
    let from = position;
    if (links) {
      for (const token of tokens) {
        const at = token.start - base, to = token.end - base;
        if (at < from || to > end) continue;
        if (at > from) nodes.push({ kind: 'text', text: source.slice(from, at), start: base + from });
        nodes.push(token.node);
        from = to;
      }
    }
    if (end > from) nodes.push({ kind: 'text', text: source.slice(from, end), start: base + from });
  };
  for (let match; (match = pattern.exec(source.slice(position)));) {
    const [whole, code, label, href, url, strong, del, em, before = '', underscore] = match;
    const at = position + match.index + before.length;
    text(at);
    let length = whole.length - before.length;
    if (code !== undefined) nodes.push({ kind: 'code', text: code, start: base + at + 1 });
    else if (label !== undefined) nodes.push({ kind: 'link', href, children: parse(label, base + at + 1, false, tokens) });
    else if (url !== undefined) {
      const trimmed = trimUrl(url);
      length = trimmed.length;
      nodes.push({ kind: 'link', href: trimmed, children: [{ kind: 'text', text: trimmed, start: base + at }] });
    } else {
      const [kind, content, open] = strong !== undefined ? ['strong', strong, 2] as const
        : del !== undefined ? ['del', del, 2] as const
        : ['em', em ?? underscore, 1] as const;
      nodes.push({ kind, children: parse(content, base + at + open, links, tokens) });
    }
    position = at + length;
  }
  text(source.length);
  return nodes;
}

function tokensOf(source: string): Token[] {
  const metas: Token[] = metaRules.flatMap(({ meta, pattern, label }) => [...source.matchAll(pattern)].map(match => {
    const text = meta === 'block' ? match[2] : match[0];
    const start = match.index + (meta === 'block' ? match[1].length : 0);
    return { start, end: start + text.length, node: { kind: 'meta', meta, label: label(match), text, start } };
  }));
  const tags: Token[] = [...source.matchAll(tagWord)].map(match => {
    const start = match.index + match[1].length, end = match.index + match[0].length;
    return { start, end, node: { kind: 'tag', tag: source.slice(start + 1, end), text: source.slice(start, end), start } };
  });
  // The earlier token wins where two overlap.
  const tokens: Token[] = [];
  for (const token of [...metas, ...tags].sort((a, b) => a.start - b.start)) {
    if (!tokens.length || tokens[tokens.length - 1].end <= token.start) tokens.push(token);
  }
  return tokens;
}

// Null when the text has neither inline Markdown, tags nor meta fields, so that it can be shown as typed.
export function parseInline(source: string): Inline[] | null {
  const nodes = parse(source, 0, true, tokensOf(source));
  return nodes.some(node => node.kind !== 'text') ? nodes : null;
}
