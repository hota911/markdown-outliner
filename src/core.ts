// Pure Markdown edits for task lists. Every function takes the whole text and returns new text,
// so callers never hold partially edited state.

export type Status = 'todo' | 'in-progress' | 'done';

export type CoreErrorCode =
  | 'noEditableItem' | 'titleNewline' | 'unknownStatus' | 'embedHasNoStatus' | 'noteFormat' | 'noteUnsafe'
  | 'invalidInsert' | 'invalidTag' | 'invalidMergeDirection' | 'mergeAcrossEmbed' | 'mergeAcrossText'
  | 'mergeBothHaveContent' | 'unsafeIndent' | 'invalidMoveDirection' | 'invalidReorder' | 'reorderSiblingsOnly'
  | 'reorderAcrossText' | 'invalidReparent' | 'reparentIntoSelf' | 'reparentSiblingsOnly'
  | 'invalidInsertPosition' | 'insertPositionInSelection' | 'reparentIntoEmbed' | 'reparentAcrossText'
  | 'invalidFileNameInput' | 'invalidFileName' | 'extractEmbed' | 'notEmbed' | 'headingReadOnly' | 'insertNextToText';

// Edits refuse with a code; the UI turns it into text in the display language (src/ui/messages.ts).
export class CoreError extends Error {
  readonly code: CoreErrorCode;
  constructor(code: CoreErrorCode) {
    super(code);
    this.name = 'CoreError';
    this.code = code;
  }
}
export type RowKind = 'task' | 'bullet' | 'embed' | 'heading';

// A heading row is an ATX heading (`#` to `######` at the start of a line). Its section runs
// until the next heading of the same or a higher level, so deeper headings and the top-level
// items under it are its children. Headings are read-only: items can only be moved into and
// added under them.
export interface Row {
  line: number;
  end: number;
  // The list indentation (two columns per level). A heading is one above the top-level items
  // it holds, -1, so its children are written at depth 0.
  depth: number;
  parentLine: number | null;
  kind: RowKind;
  title: string;
  status: Status | null;
  note: string;
  embed: string | null;
  // 1 to 6 for a heading, null for an item.
  level: number | null;
}

interface ScannedRow extends Row {
  ownEnd: number;
}

interface Scanned {
  lines: string[];
  newline: string;
  rows: ScannedRow[];
  // The first line after the frontmatter.
  body: number;
}

interface Targeted extends Scanned {
  row: ScannedRow;
}

export interface EditResult {
  text: string;
  line: number;
}

export interface InsertOptions {
  kind?: 'task' | 'bullet';
  status?: Status;
  child?: boolean;
  // Insert as the previous sibling of the item instead of after it.
  before?: boolean;
  tags: string[];
}

const statuses: Record<string, Status> = { ' ': 'todo', '/': 'in-progress', x: 'done', X: 'done' };
const marks: Record<Status, string> = { todo: ' ', 'in-progress': '/', done: 'x' };
const width = (value: string) => value.replace(/\t/g, '  ').length;
const item = (value: string) => value.match(/^([ \t]*)([-*+]) (?:\[([ xX/])\] )?(.*)$/);
// Only unindented ATX headings; an optional closing run of `#` is not part of the title.
// Setext headings (text underlined with `===` or `---`) stay ordinary text.
const heading = (value: string) => /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(value);
const indentation = (value: string) => width(/^[ \t]*/.exec(value)![0]);
const isStatus = (value: unknown): value is Status => typeof value === 'string' && value in marks;

function document(text: string) {
  if (typeof text !== 'string') throw new Error('Markdown must be text');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  return { lines: text.split(newline), newline };
}

function scan(text: string): Scanned {
  const doc = document(text);
  const rows: ScannedRow[] = [];
  const stack: ScannedRow[] = [];
  const sections: ScannedRow[] = [];
  let frontmatter = doc.lines[0] === '---';
  let body = 0;
  let fence: string | null = null;
  for (let line = 0; line < doc.lines.length; line++) {
    const source = doc.lines[line];
    if (frontmatter) {
      if (line > 0 && /^(---|\.\.\.)$/.test(source)) {
        frontmatter = false;
        body = line + 1;
      }
      continue;
    }
    const delimiter = /^\s*(`{3,}|~{3,})/.exec(source);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const title = heading(source);
    if (title) {
      const level = title[1].length;
      // A heading ends the sections of the same or a deeper level.
      while (sections.length && sections[sections.length - 1].level! >= level) sections.pop()!.end = line;
      const parent = sections[sections.length - 1];
      const row: ScannedRow = {
        line, end: doc.lines.length, ownEnd: line + 1, depth: -1, parentLine: parent ? parent.line : null,
        kind: 'heading', title: title[2] ?? '', status: null, note: '', embed: null, level,
      };
      rows.push(row);
      sections.push(row);
      stack.length = 0;
      continue;
    }
    const match = item(source);
    if (!match || width(match[1]) % 2) {
      if (source.trim() && !/^\s/.test(source)) stack.length = 0;
      continue;
    }
    const depth = width(match[1]) / 2;
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : sections[sections.length - 1];
    const embed = /^!\[\[([^\]#]+\.md)\]\]$/.exec(match[4]);
    const row: ScannedRow = {
      line, end: line + 1, ownEnd: line + 1, depth, parentLine: parent ? parent.line : null,
      kind: embed ? 'embed' : match[3] !== undefined ? 'task' : 'bullet',
      title: match[4], status: match[3] === undefined ? null : statuses[match[3]], note: '', embed: embed ? embed[1] : null, level: null,
    };
    rows.push(row);
    stack.push(row);
  }
  for (const row of rows) {
    if (row.kind === 'heading') continue;
    let ownEnd = row.line + 1;
    while (ownEnd < doc.lines.length) {
      const source = doc.lines[ownEnd];
      if (rows.some(other => other.line === ownEnd)) break;
      if (!source.trim()) {
        let next = ownEnd + 1;
        while (next < doc.lines.length && !doc.lines[next].trim()) next++;
        if (next >= doc.lines.length || indentation(doc.lines[next]) <= row.depth * 2) break;
      } else if (indentation(source) <= row.depth * 2) break;
      ownEnd++;
    }
    row.note = doc.lines.slice(row.line + 1, ownEnd).map(source => source.replace(new RegExp('^[ \\t]{0,' + (row.depth * 2 + 2) + '}'), '')).join('\n');
    row.end = ownEnd;
    row.ownEnd = ownEnd;
  }
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row.parentLine !== null) {
      const parent = rows.find(other => other.line === row.parentLine)!;
      parent.end = Math.max(parent.end, row.end);
    }
  }
  return { ...doc, rows, body };
}

export function parse(text: string): Row[] {
  return scan(text).rows.map(({ ownEnd: _ownEnd, ...row }) => row);
}

// `heading` allows a heading row, for the edits that put items under it.
function target(text: string, line: number | null, heading = false): Targeted {
  const doc = scan(text);
  const row = doc.rows.find(row => row.line === line);
  if (!Number.isInteger(line) || !row) throw new CoreError('noEditableItem');
  if (row.kind === 'heading' && !heading) throw new CoreError('headingReadOnly');
  return { ...doc, row };
}

// Where the top-level items of a section are: the lines between its heading (or, for `null`,
// the frontmatter) and the next heading of any level. Its own items always come before its
// subsections. A section with no items has an empty list right below the heading, unless it
// holds other text, where a new item would join that text: then there is no place, `null`.
function list(doc: Scanned, section: ScannedRow | null) {
  const from = section ? section.line + 1 : doc.body;
  const next = doc.rows.find(row => row.kind === 'heading' && row.line >= from);
  const to = next ? next.line : doc.lines.length;
  const items = doc.rows.filter(row => row.depth === 0 && row.parentLine === (section ? section.line : null) && row.line >= from && row.line < to);
  if (items.length) return { start: items[0].line, end: items[items.length - 1].end, empty: false };
  if (doc.lines.slice(from, to).some(value => value.trim())) return null;
  return { start: from, end: from, empty: true };
}

// The row a line belongs to: an item through its note, a heading through the text of its
// section that no item holds. `null` for text before the first heading outside any item.
function owner(doc: Scanned, line: number) {
  const own = doc.rows.find(row => row.line <= line && line < row.ownEnd);
  if (own) return own.line;
  const sections = doc.rows.filter(row => row.kind === 'heading' && row.line <= line && line < row.end);
  return sections.length ? sections[sections.length - 1].line : null;
}

const isText = (doc: Scanned, line: number) => line < doc.lines.length && doc.lines[line].trim() !== '' && !doc.rows.some(row => row.line === line);

// Moves whole items, which share a parent, to before the original line `at`, under
// `parentLine`, shifted by `amount` columns. Used when the move crosses a heading, where the
// only safe check is the result: every other line must keep its owner and every row its
// parent. Text right after an item in the source or destination would read as part of it in
// Markdown (a lazy continuation line), so that refuses too. Returns null when refused.
function relocate(doc: Scanned, moving: ScannedRow[], at: number, parentLine: number | null, amount: number) {
  if (moving.some(row => isText(doc, row.end))) return null;
  const moved = new Set(moving.flatMap(row => Array.from({ length: row.end - row.line }, (_, index) => row.line + index)));
  const kept = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => from + index).filter(line => !moved.has(line));
  const content = moving.flatMap(row => Array.from({ length: row.end - row.line }, (_, index) => row.line + index));
  const before = kept(0, at);
  // order[newLine] is the original line it came from.
  const order = [...before, ...content, ...kept(at, doc.lines.length)];
  const shifted = new Map(moving.flatMap(row => shift(doc.lines.slice(row.line, row.end), amount).map((value, index) => [row.line + index, value] as const)));
  const lines = order.map(line => shifted.get(line) ?? doc.lines[line]);
  const after = scan(lines.join(doc.newline));
  if (after.rows.length !== doc.rows.length || isText(after, before.length + content.length)) return null;
  const original = (line: number | null) => line === null ? null : order[line];
  const tops = new Set(moving.map(row => row.line));
  for (const row of after.rows) {
    const old = doc.rows.find(other => other.line === order[row.line]);
    if (!old || original(row.parentLine) !== (tops.has(old.line) ? parentLine : old.parentLine)) return null;
  }
  for (let line = 0; line < lines.length; line++) {
    if (moved.has(order[line]) || !lines[line].trim()) continue;
    if (original(owner(after, line)) !== owner(doc, order[line])) return null;
  }
  return { ...result({ lines, newline: doc.newline }, before.length), lines: movedLines(moving, before.length) };
}

const result = (doc: { lines: string[]; newline: string }, line: number): EditResult => ({ text: doc.lines.join(doc.newline), line });

function titleValue(value: string) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new CoreError('titleNewline');
  return value;
}

export function updateTitle(text: string, line: number, title: string): EditResult {
  const doc = target(text, line), match = item(doc.lines[line])!;
  doc.lines[line] = match[1] + match[2] + ' ' + (match[3] === undefined ? '' : '[' + match[3] + '] ') + titleValue(title);
  return result(doc, line);
}

export function updateStatus(text: string, line: number, status: Status): EditResult {
  if (!isStatus(status)) throw new CoreError('unknownStatus');
  const doc = target(text, line), match = item(doc.lines[line])!;
  if (doc.row.kind === 'embed') throw new CoreError('embedHasNoStatus');
  doc.lines[line] = match[1] + match[2] + ' [' + marks[status] + '] ' + match[4];
  return result(doc, line);
}

// Drops the status box of a task; a bullet stays as it is. (updateStatus turns a bullet into a task.)
export function toBullet(text: string, line: number): EditResult {
  const doc = target(text, line), match = item(doc.lines[line])!;
  if (doc.row.kind === 'embed') throw new CoreError('embedHasNoStatus');
  doc.lines[line] = match[1] + match[2] + ' ' + match[4];
  return result(doc, line);
}

// Embeds `name`, a path relative to the folder of this file, with the line extractToFile writes.
// An empty item without note or children becomes the embed; otherwise it goes in as the next sibling.
export function embedFile(text: string, line: number, name: string): EditResult {
  if (typeof name !== 'string' || !/^[^\\[\]#|^]+\.md$/.test(name)) throw new CoreError('invalidFileName');
  const doc = target(text, line);
  const embed = item(doc.lines[line])![1] + '- ![[' + name + ']]';
  if (doc.row.kind !== 'embed' && !doc.row.title && doc.row.end === line + 1) {
    doc.lines[line] = embed;
    return result(doc, line);
  }
  doc.lines.splice(doc.row.end, 0, embed);
  return result(doc, doc.row.end);
}

export function updateNote(text: string, line: number, note: string): EditResult {
  if (typeof note !== 'string' || note.includes('\r')) throw new CoreError('noteFormat');
  const doc = target(text, line);
  const original = doc.lines.slice(line + 1, doc.row.ownEnd);
  if (original.some(value => /^\s*(?:\d+[.)] |[-*+] |`{3,}|~{3,})/.test(value)) || note.split('\n').some(value => /^\s*(?:[-*+] |`{3,}|~{3,})/.test(value))) {
    throw new CoreError('noteUnsafe');
  }
  const prefix = ' '.repeat(doc.row.depth * 2 + 2);
  const content = note ? note.split('\n').map(value => prefix + value) : [];
  doc.lines.splice(line + 1, doc.row.ownEnd - line - 1, ...content);
  return result(doc, line);
}

export function insert(text: string, line: number | null, options: InsertOptions): EditResult {
  const kind = options.kind === undefined ? 'task' : options.kind;
  if (!['task', 'bullet'].includes(kind) || (kind === 'task' && !isStatus(options.status)) || !Array.isArray(options.tags)) throw new CoreError('invalidInsert');
  const tags = options.tags.map(tag => {
    if (typeof tag !== 'string' || !/^#?[^\s#]+$/.test(tag)) throw new CoreError('invalidTag');
    return '#' + tag.replace(/^#/, '');
  });
  if (options.before && (line === null || options.child)) throw new CoreError('invalidInsert');
  const doc = line === null ? scan(text) : target(text, line, true);
  const content = '- ' + (kind === 'task' ? '[' + marks[options.status!] + '] ' : '') + tags.join(' ');
  if (line !== null && (doc as Targeted).row.kind === 'heading') {
    // The first child of a heading goes first in its section's list.
    if (!options.child) throw new CoreError('headingReadOnly');
    const span = list(doc, (doc as Targeted).row);
    if (!span) throw new CoreError('insertNextToText');
    doc.lines.splice(span.start, 0, content);
    return result(doc, span.start);
  }
  if (options.before) {
    // Reuse the item's own indentation so the new line is its sibling even in tab-indented files.
    doc.lines.splice(line!, 0, item(doc.lines[line!])![1] + content);
    return result(doc, line!);
  }
  let at = line === null ? doc.lines.length : options.child ? (doc as Targeted).row.ownEnd : (doc as Targeted).row.end;
  if (line === null && doc.lines[at - 1] === '') at--;
  const depth = line === null ? 0 : (doc as Targeted).row.depth + (options.child ? 1 : 0);
  doc.lines.splice(at, 0, ' '.repeat(depth * 2) + content);
  return result(doc, at);
}

export function merge(text: string, line: number, direction: 'previous' | 'next'): EditResult & { column: number } {
  if (!['previous', 'next'].includes(direction)) throw new CoreError('invalidMergeDirection');
  const doc = target(text, line);
  const index = doc.rows.indexOf(doc.row);
  const neighbor = doc.rows[index + (direction === 'previous' ? -1 : 1)];
  if (!neighbor) return { text, line, column: direction === 'previous' ? 0 : doc.row.title.length };
  const first = direction === 'previous' ? neighbor : doc.row;
  const second = direction === 'previous' ? doc.row : neighbor;
  if (first.kind === 'heading' || second.kind === 'heading') throw new CoreError('mergeAcrossText');
  if (first.kind === 'embed' || second.kind === 'embed') throw new CoreError('mergeAcrossEmbed');
  if (doc.lines.slice(first.end, second.line).some(value => value.trim())) throw new CoreError('mergeAcrossText');
  const firstHasContent = first.note.trim() || doc.rows.some(row => row.parentLine === first.line);
  const secondHasContent = second.note.trim() || doc.rows.some(row => row.parentLine === second.line);
  if (firstHasContent && secondHasContent) throw new CoreError('mergeBothHaveContent');
  const match = item(doc.lines[first.line])!;
  doc.lines[first.line] = match[1] + match[2] + ' ' + (match[3] === undefined ? '' : '[' + match[3] + '] ') + first.title + second.title;
  const difference = (first.depth - second.depth) * 2;
  const notes = shift(doc.lines.slice(second.line + 1, second.ownEnd), difference);
  const children = shift(doc.lines.slice(second.ownEnd, second.end), difference);
  doc.lines.splice(second.line, second.end - second.line, ...children);
  doc.lines.splice(first.ownEnd, 0, ...notes);
  return { ...result(doc, first.line), column: first.title.length };
}

function shift(lines: string[], amount: number) {
  return lines.map(source => {
    if (!source.trim()) return source;
    const match = /^([ \t]*)(.*)$/.exec(source)!;
    const indentation = width(match[1]) + amount;
    if (indentation < 0) throw new CoreError('unsafeIndent');
    return ' '.repeat(indentation) + match[2];
  });
}

function siblings(doc: Targeted) {
  return doc.rows.filter(row => row.parentLine === doc.row.parentLine && row.depth === doc.row.depth);
}

export function indent(text: string, line: number): EditResult {
  const doc = target(text, line), group = siblings(doc);
  const previous = group[group.indexOf(doc.row) - 1];
  if (!previous || doc.lines.slice(previous.end, line).some(value => value.trim())) return { text, line };
  doc.lines.splice(line, doc.row.end - line, ...shift(doc.lines.slice(line, doc.row.end), 2));
  return result(doc, line);
}

export function outdent(text: string, line: number): EditResult {
  const doc = target(text, line);
  const parent = doc.rows.find(row => row.line === doc.row.parentLine);
  if (!parent || parent.kind === 'heading') return { text, line };
  const content = shift(doc.lines.slice(line, doc.row.end), -(doc.row.depth - parent.depth) * 2);
  const count = doc.row.end - line;
  doc.lines.splice(line, count);
  const at = parent.end - count;
  doc.lines.splice(at, 0, ...content);
  return result(doc, at);
}

export function move(text: string, line: number, direction: 'up' | 'down'): EditResult {
  if (!['up', 'down'].includes(direction)) throw new CoreError('invalidMoveDirection');
  const doc = target(text, line), group = siblings(doc), index = group.indexOf(doc.row);
  const other = group[index + (direction === 'up' ? -1 : 1)];
  if (!other) return moveAcross(doc, direction) ?? { text, line };
  const first = direction === 'up' ? other : doc.row, last = direction === 'up' ? doc.row : other;
  // Refuse to move across unrelated Markdown rather than silently reparent it.
  if (doc.lines.slice(first.end, last.line).some(value => value.trim())) return { text, line };
  const a = doc.lines.slice(first.line, first.end), b = doc.lines.slice(last.line, last.end);
  const gap = doc.lines.slice(first.end, last.line);
  doc.lines.splice(first.line, last.end - first.line, ...b, ...gap, ...a);
  return result(doc, direction === 'up' ? first.line : first.line + b.length + gap.length);
}

// The first or last top-level item of a section moves into the section next to it on screen:
// up to the end of the list of the section that holds the line above its heading, down to the
// start of the list of the next heading. Moving up into the text before the first heading
// needs items there already, so items do not end up above a title.
function moveAcross(doc: Targeted, direction: 'up' | 'down'): EditResult | null {
  const row = doc.row, headings = doc.rows.filter(other => other.kind === 'heading');
  if (row.depth !== 0) return null;
  let section: ScannedRow | null, at: number;
  if (direction === 'up') {
    if (row.parentLine === null) return null;
    const above = row.parentLine - 1;
    section = headings.filter(other => other.line <= above && above < other.end).pop() ?? null;
    const span = list(doc, section);
    if (!span || (!section && span.empty)) return null;
    at = span.end;
  } else {
    section = headings.find(other => other.line > row.line) ?? null;
    const span = section && list(doc, section);
    if (!span) return null;
    at = span.start;
  }
  const moved = relocate(doc, [row], at, section ? section.line : null, 0);
  return moved && { text: moved.text, line: moved.line };
}

export function reorder(text: string, lines: number[], targetLine: number, position: 'before' | 'after' = 'before'): EditResult & { lines: number[] } {
  if (!['before', 'after'].includes(position) || !Array.isArray(lines) || !lines.length) throw new CoreError('invalidReorder');
  const doc = target(text, targetLine);
  const selected = new Set(lines);
  checkSources(doc, selected);
  const moving = doc.rows.filter(row => {
    if (!selected.has(row.line)) return false;
    let parent = doc.rows.find(other => other.line === row.parentLine);
    while (parent) {
      if (selected.has(parent.line)) return false;
      const current: ScannedRow = parent;
      parent = doc.rows.find(other => other.line === current.parentLine);
    }
    return true;
  });
  const unchanged = { text, line: moving[0].line, lines: moving.map(row => row.line) };
  if (moving.some(row => targetLine >= row.line && targetLine < row.end)) return unchanged;
  if (moving.some(row => row.parentLine !== doc.row.parentLine || row.depth !== doc.row.depth)) throw new CoreError('reorderSiblingsOnly');
  const group = siblings(doc);
  const bounds = [...moving, doc.row].map(row => group.indexOf(row));
  const affected = group.slice(Math.min(...bounds), Math.max(...bounds) + 1);
  for (let index = 1; index < affected.length; index++) {
    if (doc.lines.slice(affected[index - 1].end, affected[index].line).some(value => value.trim())) throw new CoreError('reorderAcrossText');
  }
  const insertion = position === 'before' ? doc.row.line : doc.row.end;
  const at = insertion - moving.reduce((count, row) => count + (row.end <= insertion ? row.end - row.line : 0), 0);
  const content = moving.flatMap(row => doc.lines.slice(row.line, row.end));
  for (const row of [...moving].reverse()) doc.lines.splice(row.line, row.end - row.line);
  doc.lines.splice(at, 0, ...content);
  return { ...result(doc, at), lines: movedLines(moving, at) };
}

function checkSources(doc: Scanned, lines: Set<number>) {
  for (const line of lines) {
    const row = doc.rows.find(row => row.line === line);
    if (!Number.isInteger(line) || !row) throw new CoreError('noEditableItem');
    if (row.kind === 'heading') throw new CoreError('headingReadOnly');
  }
}

function movedLines(moving: ScannedRow[], at: number) {
  let nextLine = at;
  return moving.map(row => {
    const line = nextLine;
    nextLine += row.end - row.line;
    return line;
  });
}

function ancestorsInclude(doc: Scanned, start: ScannedRow | undefined, test: (row: ScannedRow) => boolean) {
  for (let ancestor = start; ancestor;) {
    if (test(ancestor)) return true;
    const current: ScannedRow = ancestor;
    ancestor = doc.rows.find(row => row.line === current.parentLine);
  }
  return false;
}

export function reparent(text: string, sourceLines: number[], targetLine: number | null, beforeLine: number | null = null): EditResult & { lines: number[] } {
  if (!Array.isArray(sourceLines) || !sourceLines.length) throw new CoreError('invalidReparent');
  const doc: Scanned & { row?: ScannedRow } = targetLine === null ? scan(text) : target(text, targetLine, true);
  const selected = new Set(sourceLines);
  checkSources(doc, selected);
  const moving = doc.rows.filter(row => selected.has(row.line)), first = moving[0];
  if (targetLine !== null && moving.some(row => targetLine >= row.line && targetLine < row.end)) throw new CoreError('reparentIntoSelf');
  if (moving.some(row => row.parentLine !== first.parentLine || row.depth !== first.depth)) throw new CoreError('reparentSiblingsOnly');
  if (beforeLine !== null) {
    const before = doc.rows.find(row => row.line === beforeLine);
    if (!Number.isInteger(beforeLine) || !before || before.parentLine !== targetLine || (targetLine === null && before.depth !== 0)) throw new CoreError('invalidInsertPosition');
    if (moving.some(row => beforeLine >= row.line && beforeLine < row.end)) throw new CoreError('insertPositionInSelection');
  }
  // A heading, or the top level of a file with headings, takes items at the end of its own list.
  const section = doc.row ? doc.row.kind === 'heading' : doc.rows.some(row => row.kind === 'heading');
  let insertion: number;
  if (beforeLine !== null) insertion = beforeLine;
  else if (section) {
    const span = list(doc, doc.row ?? null);
    if (!span) throw new CoreError('reparentAcrossText');
    insertion = span.end;
  } else {
    insertion = doc.row ? doc.row.end : doc.lines.length;
    if (targetLine === null && doc.lines[insertion - 1] === '') insertion--;
  }
  const start = Math.min(targetLine === null ? insertion : targetLine, first.line);
  const end = Math.max(doc.row && !section ? doc.row.end : Math.min(insertion + 1, doc.lines.length), moving[moving.length - 1].end);
  // An embed line is moved like an item, but nothing goes under it: its children would read as
  // part of the embedded file.
  if (ancestorsInclude(doc, doc.row, row => row.kind === 'embed')) throw new CoreError('reparentIntoEmbed');
  const depth = doc.row ? doc.row.depth + 1 : 0;
  if (section || doc.rows.some(row => row.kind === 'heading' && row.line >= start && row.line < end)) {
    const moved = relocate(doc, moving, insertion, targetLine, (depth - first.depth) * 2);
    if (!moved) throw new CoreError('reparentAcrossText');
    return moved;
  }
  for (let line = start; line < end; line++) {
    if (doc.lines[line].trim() && !doc.rows.some(row => line >= row.line && line < row.ownEnd)) throw new CoreError('reparentAcrossText');
  }
  const at = insertion - moving.reduce((count, row) => count + (row.end <= insertion ? row.end - row.line : 0), 0);
  const content = moving.flatMap(row => shift(doc.lines.slice(row.line, row.end), (depth - row.depth) * 2));
  for (const row of [...moving].reverse()) doc.lines.splice(row.line, row.end - row.line);
  doc.lines.splice(at, 0, ...content);
  return { ...result(doc, at), lines: movedLines(moving, at) };
}

// Characters that break file names on common platforms or Obsidian wiki links.
const unusableInFileName = /[/\\:*?"<>|#^[\]]/g;

// `untitled` is the base name used when nothing usable is left of the title.
export function fileName(title: string, existingNames: string[], untitled: string): string {
  if (typeof title !== 'string' || !Array.isArray(existingNames)) throw new CoreError('invalidFileNameInput');
  const base = title.split(/\s+/).filter(word => !word.startsWith('#')).join(' ')
    .replace(unusableInFileName, '').replace(/\s+/g, ' ').trim()
    // A leading dot would make a hidden file that the file list skips.
    .replace(/^[.\s]+/, '') || untitled;
  const taken = new Set(existingNames.map(name => name.toLowerCase()));
  let name = base + '.md';
  for (let number = 2; taken.has(name.toLowerCase()); number++) name = base + ' ' + number + '.md';
  return name;
}

function dedent(lines: string[], amount: number) {
  return lines.map(source => {
    let index = 0, removed = 0;
    while (removed < amount && /[ \t]/.test(source[index] || '')) removed += source[index++] === '\t' ? 2 : 1;
    if (removed > amount || (removed < amount && source.trim())) throw new CoreError('unsafeIndent');
    return source.slice(index);
  });
}

export function extractToFile(text: string, line: number, name: string): EditResult & { extracted: string } {
  if (typeof name !== 'string' || !/^[^/\\[\]#|^]+\.md$/.test(name)) throw new CoreError('invalidFileName');
  const doc = target(text, line);
  if (doc.row.kind === 'embed') throw new CoreError('extractEmbed');
  const extracted = dedent(doc.lines.slice(line, doc.row.end), doc.row.depth * 2).join(doc.newline) + doc.newline;
  doc.lines.splice(line, doc.row.end - line, item(doc.lines[line])![1] + '- ![[' + name + ']]');
  return { ...result(doc, line), extracted };
}

// Whether a base name (without `.md`) typed by the user can name a file: not empty, no
// surrounding spaces, no leading dot (a hidden file the file list skips), no control characters,
// and none of the characters that break file names or embeds (as removed by `fileName`).
export function usableBaseName(name: string): boolean {
  return typeof name === 'string' && name !== '' && name === name.trim() && !name.startsWith('.')
    && !/[/\\:*?"<>|#^[\]]/.test(name) && !/\p{Cc}/u.test(name);
}

// The embed target after its file is renamed to `baseName`; the folder part stays as written.
export function renamedEmbed(embed: string, baseName: string): string {
  if (typeof embed !== 'string' || !usableBaseName(baseName)) throw new CoreError('invalidFileName');
  return embed.replace(/[^/\\]*$/, baseName + '.md');
}

// Points the embed on `line` at `embed`. Obsidian may already have rewritten the link when it
// renamed the file, possibly without `.md`, so any `![[...]]` item counts as the embed.
export function retargetEmbed(text: string, line: number, embed: string): EditResult {
  if (typeof embed !== 'string' || !/^[^[\]#|^]+\.md$/.test(embed)) throw new CoreError('invalidFileName');
  const doc = target(text, line);
  if (!/^!\[\[[^\]]+\]\]$/.test(doc.row.title)) throw new CoreError('notEmbed');
  const source = doc.lines[line];
  doc.lines[line] = source.slice(0, source.length - doc.row.title.length) + '![[' + embed + ']]';
  return result(doc, line);
}

// The tags written as `#tag` in a text, without the `#`, in order of first appearance. As in
// Obsidian, a tag starts at the start of the text or after whitespace, runs over letters, digits,
// `_`, `-` and `/` (nested tags), and is not only digits.
export function tagsIn(text: string): string[] {
  const tags = new Set<string>();
  for (const [, tag] of text.matchAll(/(?<!\S)#([\p{L}\p{M}\p{N}_/-]+)/gu)) {
    if (!/^\d+$/.test(tag)) tags.add(tag);
  }
  return [...tags];
}
