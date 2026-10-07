// Inline Markdown shown over item titles and notes while they are not being edited.
// The result is data for the template to build DOM from; nothing here produces HTML.
// Text and code leaves keep their offset in the source so that a click can put the caret there.
export type Inline =
  | { kind: 'text' | 'code'; text: string; start: number }
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'strong' | 'em' | 'del'; children: Inline[] };

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

// Trailing punctuation usually ends the sentence rather than the URL.
function trimUrl(url: string) {
  for (;;) {
    const last = url[url.length - 1];
    const unbalanced = (open: string, close: string) => last === close && url.split(open).length < url.split(close).length;
    if (/[.,;:!?'"*_~]/.test(last) || unbalanced('(', ')') || unbalanced('[', ']')) url = url.slice(0, -1);
    else return url;
  }
}

function parse(source: string, base: number, links: boolean): Inline[] {
  const nodes: Inline[] = [];
  const pattern = links ? withLinks : withoutLinks;
  let position = 0;
  const text = (end: number) => {
    if (end > position) nodes.push({ kind: 'text', text: source.slice(position, end), start: base + position });
  };
  for (let match; (match = pattern.exec(source.slice(position)));) {
    const [whole, code, label, href, url, strong, del, em, before = '', underscore] = match;
    const at = position + match.index + before.length;
    text(at);
    let length = whole.length - before.length;
    if (code !== undefined) nodes.push({ kind: 'code', text: code, start: base + at + 1 });
    else if (label !== undefined) nodes.push({ kind: 'link', href, children: parse(label, base + at + 1, false) });
    else if (url !== undefined) {
      const trimmed = trimUrl(url);
      length = trimmed.length;
      nodes.push({ kind: 'link', href: trimmed, children: [{ kind: 'text', text: trimmed, start: base + at }] });
    } else {
      const [kind, content, open] = strong !== undefined ? ['strong', strong, 2] as const
        : del !== undefined ? ['del', del, 2] as const
        : ['em', em ?? underscore, 1] as const;
      nodes.push({ kind, children: parse(content, base + at + open, links) });
    }
    position = at + length;
  }
  text(source.length);
  return nodes;
}

// Null when the text has no inline Markdown, so that it can be shown as typed.
export function parseInline(source: string): Inline[] | null {
  const nodes = parse(source, 0, true);
  return nodes.some(node => node.kind !== 'text') ? nodes : null;
}
