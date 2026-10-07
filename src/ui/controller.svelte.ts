import { flushSync } from 'svelte';
import * as core from '../core.ts';
import type { Status } from '../core.ts';
import { merge3, type Side } from '../three-way-merge.ts';
import { RowKeys, type KeyedRow } from './keys.ts';
import { filterActive, rowMatches, type FilterQuery, type TextQuery } from './filter.ts';
import { errorText, messages, type Messages } from './messages.ts';
import type { Adapter, Bookmark, BookmarkZoom, Doc, MountOptions, Preferences, Revision, StatusFilter } from './types.ts';

export type Field = 'title' | 'note';
type RowKind = 'task' | 'bullet';

interface Focus { path: string; line: number; field: Field }
// The focus is captured with the texts so that undo and redo can put the caret back where the
// edit happened; otherwise keyboard shortcuts stop reaching the outliner after the first undo.
interface Snapshot { texts: Map<string, string>; focus: Focus | null }

export interface Drop {
  parentLine: number | null;
  beforeLine: number | null;
  line?: number;
  position?: 'before' | 'after';
  indicator: 'drop-before' | 'drop-after' | 'drop-child';
  offset?: number;
}

type SlashCommand = keyof Messages['slash']['command'];
// The `/` or `#` menu of a title. `start` is the offset of the `/` or `#`, and the text after it up
// to the caret is `query`. The 'files' step lists the files to embed, filtered by the same query.
// The 'tags' step, opened by `#`, lists the tags in use (`tags`, sorted).
interface Slash { path: string; line: number; start: number; query: string; step: 'commands' | 'files' | 'tags'; index: number; files: string[]; tags: string[] }
export interface SlashMenu { id: string; label: string; options: { id: string; label: string }[]; index: number }
// Gives each outliner its own option ids; Obsidian can show several outliners in one document.
let slashMenus = 0;

// Folds text for matching commands: full-width and half-width forms (NFKC), case, and katakana to
// hiragana, so `ノート`, `のーと` and `ﾉｰﾄ` match each other.
function foldKana(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const trigger = (slash: Slash) => slash.step === 'tags' ? '#' : '/';
const sortTags = (tags: Iterable<string>) => [...new Set(tags)].sort((a, b) => a.localeCompare(b));

// The path of `target` relative to the folder of `from`, as embeds are written (see normalize).
function relativePath(from: string, target: string) {
  const folder = from.split('/').slice(0, -1), parts = target.split('/');
  let common = 0;
  while (common < folder.length && common < parts.length - 1 && folder[common] === parts[common]) common++;
  return [...folder.slice(common).map(() => '..'), ...parts.slice(common)].join('/');
}

export const statuses: Status[] = ['todo', 'in-progress', 'done'];
export const filters: StatusFilter[] = ['all', 'not-done', ...statuses];
export const statusIcons: Record<Status, string> = { todo: '○', 'in-progress': '◐', done: '✓' };
// Icons of the status filter options; 'all' has none since it is not narrowed to any status.
export const filterIcons: Record<StatusFilter, string> = { all: '', 'not-done': '◌', ...statusIcons };
const nextStatus = (status: Status | null) => statuses[(statuses.indexOf(status!) + 1) % statuses.length];

// Attachment that writes the model value into an input on every render. A `value` attribute
// is not enough: Svelte compares with the previously rendered value, not with what the user
// typed since, so undo back to that value would leave the typed text in place.
export const syncValue = (value: () => string) => (node: HTMLInputElement | HTMLTextAreaElement) => {
  const next = value();
  if (node.value !== next) node.value = next;
};

// Blank lines at the end of a note cannot be kept in the Markdown: they would separate the note
// from what follows rather than belong to it. They are left out of the file, and the textarea
// being typed in keeps them, so Enter at the end of a note starts a new line.
export const noteText = (value: string) => value.replace(/(?:\n[ \t]*)+$/, '');

// syncValue for a note textarea; the focused one keeps the blank lines typed at its end.
export const syncNote = (value: () => string) => (node: HTMLTextAreaElement) => {
  const next = value();
  if (node === node.ownerDocument.activeElement && noteText(node.value) === next) return;
  if (node.value !== next) node.value = next;
};

// The tag (without `#`) of the whitespace-separated word around `offset`, or null when that word
// is not a tag. A word counts as a tag exactly when the search box would treat it as one.
export function tagAt(text: string, offset: number): string | null {
  const word = text.slice(0, offset).match(/\S*$/)![0] + text.slice(offset).match(/^\S*/)![0];
  return /^#[^#\s]+$/.test(word) ? word.slice(1) : null;
}

export interface ItemView {
  key: string;
  path: string;
  row: KeyedRow;
  depth: number;
  rootLine: number | null;
  selected: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  showNote: boolean;
  status: { icon: string; label: string; next: Status } | null;
  // Shown only because a descendant matches the active filter; rendered dimmed.
  context: boolean;
  // The search box words and #tags to mark in the title; null without a text filter and for context rows.
  highlight: TextQuery | null;
  embed: { target: string | null; error: string | null; outline: OutlineView | null } | null;
  // Drop targets after the last shown descendant of each ancestor that ends here, innermost first.
  ends: { key: string; parentLine: number; depth: number; label: string }[];
}

export interface ZoomView {
  row: KeyedRow;
  status: { icon: string; label: string; next: Status } | null;
  showNote: boolean;
}

export type OutlineView =
  | { kind: 'cycle'; path: string }
  | { kind: 'missing' }
  | { kind: 'outline'; path: string; zoom: ZoomView | null; items: ItemView[]; addKind: RowKind; appendLine: number | null; appendChild: boolean };

// `defaultLabel` is the label derived from the view, shown while renaming; empty for an unreadable bookmark.
export interface BookmarkView { bookmark: unknown; label: string; title: string; defaultLabel: string }

export interface View {
  fileList: string[];
  // Null until the first file is chosen, and while the folder has no Markdown files.
  current: string | null;
  noFiles: boolean;
  filter: StatusFilter;
  searchValue: string;
  canOpenSource: boolean;
  autoSave: boolean;
  selectionCount: number;
  zoomPath: string | null;
  // `hunks` is null when the save failed without a conflicting external version.
  conflicts: { path: string; text: string; hunks: { ours: string | null; theirs: string | null }[] | null }[];
  outline: OutlineView | null;
  sidebarCollapsed: boolean;
  bookmarksValid: boolean;
  bookmarks: BookmarkView[];
}

function validBookmark(bookmark: unknown): bookmark is Bookmark {
  const value = bookmark as Bookmark | null;
  const zoom = value?.zoom;
  return !!value && typeof value.id === 'string' && ['file', 'search', 'view'].includes(value.kind)
    && typeof value.file === 'string' && value.file.length > 0
    && filters.includes(value.status)
    && Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string')
    && (value.searchText === undefined || typeof value.searchText === 'string')
    && (zoom === undefined || !!zoom && typeof zoom.path === 'string' && Number.isInteger(zoom.line) && typeof zoom.title === 'string')
    && (value.name === undefined || typeof value.name === 'string');
}

// What a bookmark restores. A 'file' bookmark of 0.1.x shows the file without filters.
interface SavedView { file: string; status: StatusFilter; tags: string[]; searchText: string; zoom: BookmarkZoom | null }

const savedView = (bookmark: Bookmark): SavedView => bookmark.kind === 'file'
  ? { file: bookmark.file, status: 'all', tags: [], searchText: '', zoom: null }
  : { file: bookmark.file, status: bookmark.status, tags: bookmark.tags, searchText: bookmark.searchText || '', zoom: bookmark.zoom ?? null };

// The zoomed item is compared by title, the same way openBookmark() finds it again.
const sameView = (a: SavedView, b: SavedView) => a.file === b.file && a.status === b.status
  && JSON.stringify(a.tags) === JSON.stringify(b.tags) && a.searchText === b.searchText
  && (a.zoom === null ? b.zoom === null : b.zoom !== null && a.zoom.path === b.zoom.path && a.zoom.title === b.zoom.title);

// Saves of one file per save request, when external changes keep merging cleanly in between.
const SAVE_ATTEMPTS = 3;

// The lines of one side of a conflict for display; null when that side removed them.
const shownLines = (lines: string[]) => lines.length ? lines.join('\n') : null;

// One line of title text, matching the textarea's minimum height in styles.css.
const MIN_TITLE_HEIGHT = 28;

// Holds the editing state and every operation of the outliner. Svelte components render the
// view model from view() whenever render() bumps `version`, and call these methods on events.
export class Controller {
  version = $state(0);
  toast = $state('');
  notice = $state('');
  saveState = $state({ text: '', dirty: false });
  searchSaved = $state(false);
  private slash = $state<Slash | null>(null);
  private readonly slashId = 'outliner-slash-' + ++slashMenus;

  // Messages in the display language chosen by the host (see MountOptions.language).
  readonly t: Messages;
  readonly docs: Map<string, Doc>;
  private readonly adapter: Adapter;
  private readonly preferences: Preferences;
  private readonly savePreferences?: (value: Preferences) => Promise<void>;
  private preferenceSave: Promise<void> = Promise.resolve();
  private readonly initialFile?: string;
  private current: string | null = null;
  private fileList: string[] = [];
  private noFiles = false;
  private filter: StatusFilter = 'all';
  private tags = '';
  private textSearch = '';
  private zoom: { path: string; line: number } | null = null;
  private active: Focus | null = null;
  private composing = false;
  private deferred = false;
  // An external change to an unedited file waits while the user may be typing; the status says so.
  private externalPending = false;
  // Set when the user comes back to the outliner; the next poll then applies external changes
  // even though a field still has focus.
  private resumeRequested = false;
  private destroyed = false;
  private polling = false;
  private rendering = false;
  private message = '';
  private busy = false;
  private autoSave = true;
  private saveTimer: number | undefined;
  private toastTimer: number | undefined;
  private pollTimer: number | undefined;
  // Timer IDs belong to the window that created them, and the view may live in a popout window.
  private pollWindow: Window | null = null;
  private selectedPath: string | null = null;
  private selectedLines = new Set<number>();
  private selectionAnchor: number | null = null;
  private dragging: { path: string; lines: number[] } | null = null;
  private readonly collapsed = new Set<string>();
  private readonly kept = new Map<string, Set<number>>();
  private readonly undo: Snapshot[] = [];
  private readonly redo: Snapshot[] = [];
  private readonly keys = new RowKeys();
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private titleWidth = 0;
  private focusRootAfterRender = false;
  private renderCount = 0;
  private readonly recorded = new WeakMap<HTMLElement, number>();

  constructor({ adapter, drafts, initialFile, language, preferences = { bookmarks: [] }, savePreferences }: MountOptions) {
    this.t = messages[language];
    this.adapter = adapter;
    this.docs = drafts || new Map<string, Doc>();
    this.initialFile = initialFile;
    this.preferences = preferences;
    this.savePreferences = savePreferences;
  }

  get canRename() {
    return !!this.adapter.rename;
  }

  private describe(error: unknown) {
    return errorText(this.t, error);
  }

  // Starts timers and listeners once the component is in the document.
  attach(container: HTMLElement) {
    this.container = container;
    const view = container.ownerDocument.defaultView!;
    if (typeof view.ResizeObserver === 'function') {
      this.resizeObserver = new view.ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (width === this.titleWidth) return;
        this.titleWidth = width;
        for (const node of container.querySelectorAll<HTMLTextAreaElement>('.title-input')) this.fitTitle(node);
      });
      this.resizeObserver.observe(container);
    }
    this.pollWindow = view;
    this.pollTimer = view.setInterval(() => { void this.poll(); }, 3000);
    view.addEventListener('focus', this.resume);
    view.document.addEventListener('visibilitychange', this.resume);
    this.render();
    this.adapter.list().then(list => {
      this.fileList = list;
      // lastFile comes from user-editable storage, so it is only used when it matches a listed file.
      const first = this.initialFile ?? list.find(file => file === this.preferences.lastFile) ?? list.at(0);
      if (first === undefined) {
        this.noFiles = true;
        this.render();
        return;
      }
      return this.openFile(first);
    }).catch((error: unknown) => { this.message = this.describe(error); this.render(); });
  }

  destroy() {
    this.destroyed = true;
    this.pollWindow?.clearInterval(this.pollTimer);
    this.pollWindow?.removeEventListener('focus', this.resume);
    this.pollWindow?.document.removeEventListener('visibilitychange', this.resume);
    this.resizeObserver?.disconnect();
    window.clearTimeout(this.saveTimer);
    this.clearToast();
  }

  // The height lives in styles.css; only the measured value is passed as a CSS variable.
  // (setCssProps is Obsidian-only, and this also runs in the web app and jsdom.)
  fitTitle(node: HTMLTextAreaElement) {
    const setHeight = (pixels: number) => node.style.setProperty('--title-height', pixels + 'px');
    // Shrink to one line first so scrollHeight reflects the content, not the previous height.
    setHeight(MIN_TITLE_HEIGHT);
    setHeight(Math.max(MIN_TITLE_HEIGHT, node.scrollHeight));
  }

  private get activeElement() {
    return this.container?.ownerDocument.activeElement ?? null;
  }

  private rows(path: string, text = this.docs.get(path)!.text) {
    return this.keys.rows(path, text);
  }

  private scheduleSave() {
    window.clearTimeout(this.saveTimer);
    if (!this.autoSave || this.destroyed) return;
    this.saveTimer = window.setTimeout(() => {
      if (this.busy || this.composing || this.polling) { this.scheduleSave(); return; }
      if ([...this.docs.values()].some(doc => doc.dirty && !doc.conflict)) void this.saveAll(true);
    }, 800);
  }

  private clearSelection() {
    this.selectedPath = null;
    this.selectedLines.clear();
    this.selectionAnchor = null;
  }

  clearToast = () => {
    window.clearTimeout(this.toastTimer);
    this.toast = '';
  };

  private showToast(text: string) {
    this.clearToast();
    this.toast = text;
    this.toastTimer = window.setTimeout(this.clearToast, 4500);
  }

  private key = (path: string, line: number) => path + ':' + line;
  private tagList = () => this.tags.trim().split(/\s+/).filter(Boolean).map(tag => tag.replace(/^#/, ''));
  private searchValue = () => [this.textSearch.trim(), this.tagList().map(tag => '#' + tag).join(' ')].filter(Boolean).join(' ');

  private parseSearch(value: string) {
    const queryTags: string[] = [];
    const words: string[] = [];
    for (const word of value.trim().split(/\s+/).filter(Boolean)) {
      if (/^#[^#\s]+$/.test(word)) queryTags.push(word.slice(1));
      else words.push(word);
    }
    this.tags = queryTags.join(' ');
    this.textSearch = words.join(' ');
  }

  private keepFor(path: string) {
    return [...(this.kept.get(path) || []), ...(this.active && this.active.path === path ? [this.active.line] : [])];
  }

  private normalize(from: string, target: string | null) {
    if (typeof target !== 'string' || !target || /^(?:[/\\]|[a-zA-Z]:|[a-zA-Z]+:)/.test(target)) throw new Error(this.t.edit.embedRelativePath);
    const parts = from.split('/').slice(0, -1);
    for (const part of target.replace(/\\/g, '/').split('/')) {
      if (part === '..') {
        if (!parts.length) throw new Error(this.t.edit.embedOutsideFolder);
        parts.pop();
      } else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  }

  private async load(path: string) {
    const existing = this.docs.get(path);
    if (existing) return existing;
    const result = await this.adapter.read(path);
    const doc: Doc = { text: result.text, baseText: result.text, baseRevision: result.revision, dirty: false, conflict: false };
    this.docs.set(path, doc);
    return doc;
  }

  private async loadEmbeds(path: string, chain: string[] = []) {
    if (chain.includes(path)) return;
    const doc = await this.load(path);
    for (const row of this.rows(path, doc.text)) {
      if (row.kind !== 'embed') continue;
      try { await this.loadEmbeds(this.normalize(path, row.embed), [...chain, path]); }
      catch { /* A visible notice is rendered at this embed. */ }
    }
  }

  private capture(): Snapshot {
    return { texts: new Map([...this.docs].map(([path, doc]) => [path, doc.text])), focus: this.active && { ...this.active } };
  }

  private remember() {
    this.undo.push(this.capture());
    if (this.undo.length > 100) this.undo.shift();
    this.redo.length = 0;
  }

  private applySnapshot(snapshot: Snapshot) {
    for (const [path, text] of snapshot.texts) {
      const doc = this.docs.get(path);
      if (doc && doc.text !== text) { doc.text = text; doc.dirty = true; }
    }
    this.kept.clear();
    const focus = snapshot.focus;
    const doc = focus && this.docs.get(focus.path);
    this.active = doc && this.rows(focus.path, doc.text).some(row => row.line === focus.line) ? { ...focus } : null;
    this.focusRootAfterRender = true;
    this.clearSelection();
    this.scheduleSave();
    this.render();
  }

  history = (back: boolean) => {
    const source = back ? this.undo : this.redo;
    const snapshot = source.pop();
    if (!snapshot) return;
    (back ? this.redo : this.undo).push(this.capture());
    this.applySnapshot(snapshot);
  };

  completeActive = () => {
    if (this.composing || !this.active) return false;
    const { path, line, field } = this.active;
    const row = this.rows(path).find(row => row.line === line);
    if (!row) return false;
    if (row.status === 'in-progress') this.mutate(path, text => core.updateStatus(text, line, 'done'), field);
    return true;
  };

  // `focusOffset` moves the focus that many lines below `result.line`, which stays visible too.
  private mutate(path: string, fn: (text: string) => core.EditResult, focus: Field | null, focusOffset = 0) {
    const doc = this.docs.get(path)!;
    let result: core.EditResult;
    try { result = fn(doc.text); }
    catch (error) { this.showToast(this.describe(error)); return; }
    this.message = '';
    if (result.text === doc.text) return;
    this.remember();
    const folded = this.rows(path, doc.text).filter(row => this.collapsed.has(this.key(path, row.line)));
    doc.text = result.text;
    doc.dirty = true;
    this.clearSelection();
    this.scheduleSave();
    for (const id of [...this.collapsed]) if (id.startsWith(path + ':')) this.collapsed.delete(id);
    for (const row of this.rows(path, doc.text)) {
      if (folded.some(previous => previous.kind === row.kind && previous.title === row.title && previous.embed === row.embed)) this.collapsed.add(this.key(path, row.line));
    }
    this.kept.clear();
    if (focus && result.line !== null) {
      this.kept.set(path, new Set([result.line, result.line + focusOffset]));
      this.active = { path, line: result.line + focusOffset, field: focus };
    } else this.active = null;
    if (this.zoom && this.zoom.path === path) {
      const zoomLine = this.zoom.line;
      if (zoomLine === result.line || !this.rows(path, doc.text).some(row => row.line === zoomLine)) this.zoom.line = result.line;
    }
    this.render();
  }

  private inputEdit(path: string, line: number, field: Field, value: string) {
    const doc = this.docs.get(path)!;
    let result: core.EditResult;
    try { result = field === 'note' ? core.updateNote(doc.text, line, noteText(value)) : core.updateTitle(doc.text, line, value); }
    catch (error) {
      this.message = this.describe(error);
      this.notice = this.message;
      return;
    }
    const delta = result.text.split('\n').length - doc.text.split('\n').length;
    if (delta) {
      const existing = this.kept.get(path);
      if (existing) this.kept.set(path, new Set([...existing].map(value => value > line ? value + delta : value)));
      if (this.active && this.active.path === path && this.active.line > line) this.active.line += delta;
      if (this.zoom && this.zoom.path === path && this.zoom.line > line) this.zoom.line += delta;
      if (this.selectedPath === path) {
        this.selectedLines = new Set([...this.selectedLines].map(value => value > line ? value + delta : value));
        if (this.selectionAnchor !== null && this.selectionAnchor > line) this.selectionAnchor += delta;
      }
      for (const id of [...this.collapsed]) {
        if (!id.startsWith(path + ':')) continue;
        const value = Number(id.slice(path.length + 1));
        if (value > line) { this.collapsed.delete(id); this.collapsed.add(this.key(path, value + delta)); }
      }
    }
    doc.text = result.text;
    doc.dirty = true;
    this.scheduleSave();
    this.updateStatus();
    // Line numbers after the edited row moved, so handlers and data-line attributes must follow.
    if (delta) this.refresh();
  }

  private insertion(child: boolean) {
    return { child, status: (this.filter === 'all' || this.filter === 'not-done' ? 'todo' : this.filter), tags: this.tagList() };
  }

  add = (path: string, line: number | null, child: boolean, kind?: RowKind) => {
    const source = this.rows(path).find(row => row.line === line);
    const nextKind = kind || (source?.kind === 'bullet' ? 'bullet' : 'task');
    this.mutate(path, text => core.insert(text, line, { ...this.insertion(child), kind: nextKind }), 'title');
  };

  // Enter at the start of a title: the new item goes above, and the caret stays at the start of
  // the item, so repeated Enter keeps pushing it down.
  private addAbove(path: string, row: KeyedRow) {
    const kind = row.kind === 'bullet' ? 'bullet' : 'task';
    this.mutate(path, text => core.insert(text, row.line, { ...this.insertion(false), kind, before: true }), 'title', 1);
  }

  private merge(path: string, row: KeyedRow, backwards: boolean) {
    let column: number | undefined;
    this.mutate(path, text => {
      const result = core.merge(text, row.line, backwards ? 'previous' : 'next');
      column = result.column;
      return result;
    }, 'title');
    const focused = this.activeElement;
    if (column !== undefined && focused instanceof HTMLTextAreaElement && focused.dataset.field === 'title') focused.setSelectionRange(column, column);
  }

  extractToFile = async (path: string, line: number) => {
    const doc = this.docs.get(path)!;
    if (this.selectedLines.size > 1) { this.showToast(this.t.edit.extractMultiple); return; }
    if (!this.adapter.create) { this.showToast(this.t.edit.extractSingleFile); return; }
    if (this.busy || doc.conflict) { this.showToast(this.t.edit.extractBusy); return; }
    this.busy = true;
    this.updateStatus();
    const before = doc.text;
    const folder = path.split('/').slice(0, -1).join('/');
    let name: string, relative: string, result: ReturnType<typeof core.extractToFile>, created: { revision: Doc['baseRevision'] };
    try {
      const siblings = (await this.adapter.list()).filter(file => file.split('/').slice(0, -1).join('/') === folder).map(file => file.split('/').pop()!);
      const row = this.rows(path, before).find(value => value.line === line)!;
      name = core.fileName(row.title, siblings, this.t.edit.untitledFile);
      relative = folder ? folder + '/' + name : name;
      result = core.extractToFile(before, line, name);
      // The new file is created first so that a failure leaves the original untouched.
      created = await this.adapter.create(relative, result.extracted);
    } catch (error) {
      this.busy = false;
      this.updateStatus();
      this.showToast(this.t.edit.extractFailed(this.describe(error)));
      return;
    }
    this.busy = false;
    this.updateStatus();
    if (doc.text !== before) {
      this.showToast(this.t.edit.extractChanged(name));
      return;
    }
    this.docs.set(relative, { text: result.extracted, baseText: result.extracted, baseRevision: created.revision, dirty: false, conflict: false });
    if (!this.fileList.includes(relative)) this.fileList.push(relative);
    this.mutate(path, () => result, null);
    // Undo cannot remove the created file, so restoring older snapshots would duplicate the item.
    this.undo.length = 0;
    this.redo.length = 0;
    await this.saveAll();
    this.showToast(this.t.edit.extracted(name));
  };

  // Renames the file embedded at `line` of `path` within its folder, then points the embed at
  // the new name. Other files that embed or link the old name are left to the host.
  renameEmbed = async (path: string, line: number, baseName: string) => {
    const row = this.rows(path).find(value => value.line === line);
    if (row?.kind !== 'embed' || !row.embed) return;
    const name = baseName.trim();
    if (name === row.embed.replace(/^.*[/\\]/, '').replace(/\.md$/, '')) return;
    if (!core.usableBaseName(name)) { this.showToast(this.t.edit.renameInvalidName); return; }
    // The button is shown only when the host can rename.
    const rename = this.adapter.rename?.bind(this.adapter);
    if (!rename) return;
    if (this.busy || this.polling) { this.showToast(this.t.edit.renameBusy); return; }
    let target: string, embed: string, newTarget: string;
    try {
      target = this.normalize(path, row.embed);
      embed = core.renamedEmbed(row.embed, name);
      newTarget = this.normalize(path, embed);
    } catch (error) { this.showToast(this.t.edit.renameFailed(this.describe(error))); return; }
    // The host renames the file on disk, so unsaved input is saved first.
    await this.saveAll();
    if ([path, target].some(file => this.docs.get(file)?.dirty || this.docs.get(file)?.conflict)) {
      this.showToast(this.t.edit.renameUnsaved);
      return;
    }
    if (this.busy || this.polling) { this.showToast(this.t.edit.renameBusy); return; }
    this.busy = true;
    this.updateStatus();
    try {
      await rename(target, newTarget);
    } catch (error) {
      this.busy = false;
      this.updateStatus();
      this.showToast(this.t.edit.renameFailed(this.describe(error)));
      return;
    }
    this.moveFile(target, newTarget);
    // Obsidian may already have rewritten the embed while updating links, so the embedding file
    // is read again before the line is changed.
    let containing: { text: string; revision: Revision } | null = null;
    try { containing = await this.adapter.read(path); } catch { /* Without it, the embed line is updated on the text already loaded. */ }
    this.busy = false;
    this.updateStatus();
    const doc = this.docs.get(path)!;
    const fileName = newTarget.split('/').pop()!;
    if (containing && containing.revision !== doc.baseRevision && !doc.dirty) this.replaceText(path, doc, containing.text, containing);
    // Snapshots hold the old path, and undo cannot rename the file back.
    this.undo.length = 0;
    this.redo.length = 0;
    // Lines may have moved since Enter, through typing or an external change, so the line is
    // found again rather than trusted.
    const current = this.embedLineOf(path, line, [target, newTarget]);
    if (current === null) {
      this.render();
      this.showToast(this.t.edit.renameEmbedNotFound(fileName));
      return;
    }
    const id = this.key(path, current);
    const folded = this.collapsed.has(id);
    this.mutate(path, text => core.retargetEmbed(text, current, embed), null);
    if (folded) this.collapsed.add(id);
    this.render();
    await this.saveAll();
    this.showToast(this.t.edit.renamed(fileName));
  };

  // Moves every piece of state keyed by a file path after the host renamed that file.
  private moveFile(from: string, to: string) {
    const doc = this.docs.get(from);
    if (doc) { this.docs.delete(from); this.docs.set(to, doc); }
    this.fileList = [...this.fileList.filter(file => file !== from && file !== to), to].sort();
    for (const id of [...this.collapsed]) {
      if (!id.startsWith(from + ':')) continue;
      this.collapsed.delete(id);
      this.collapsed.add(to + id.slice(from.length));
    }
    const kept = this.kept.get(from);
    if (kept) { this.kept.delete(from); this.kept.set(to, kept); }
    if (this.current === from) this.current = to;
    if (this.zoom?.path === from) this.zoom = { ...this.zoom, path: to };
    if (this.active?.path === from) this.active = { ...this.active, path: to };
    if (this.selectedPath === from) this.selectedPath = to;
    let changed = false;
    if (this.preferences.lastFile === from) { this.preferences.lastFile = to; changed = true; }
    if (Array.isArray(this.preferences.bookmarks)) {
      for (const bookmark of this.preferences.bookmarks) {
        if (validBookmark(bookmark) && bookmark.file === from) { bookmark.file = to; changed = true; }
      }
    }
    if (changed) this.persistPreferences();
  }

  // The line of `path` whose `![[...]]` item resolves to one of `targets`: `line` when it still
  // does, else the only such line. Null when there is none or more than one, so nothing is guessed.
  // A link without `.md` counts, as Obsidian writes it that way when it updates links.
  private embedLineOf(path: string, line: number, targets: string[]) {
    const lines = this.rows(path).filter(row => {
      const link = /^!\[\[([^\]]+)\]\]$/.exec(row.title)?.[1];
      if (!link) return false;
      try { return targets.includes(this.normalize(path, link.endsWith('.md') ? link : link + '.md')); }
      catch { return false; }
    }).map(row => row.line);
    if (lines.includes(line)) return line;
    return lines.length === 1 ? lines[0] : null;
  }

  // --- Field events -------------------------------------------------------------------------

  private focusField(path: string, line: number, field: Field, node: HTMLTextAreaElement) {
    this.active = { path, line, field };
    const latest = this.rows(path).find(value => value.line === line);
    if (latest) {
      const value = field === 'note' ? latest.note : latest.title;
      if (node.value !== value) node.value = value;
    }
    if (field === 'title') this.fitTitle(node);
  }

  // Event handlers for a title or note textarea; `row` returns the row as of the latest render.
  fieldEvents(path: string, row: () => KeyedRow, field: Field) {
    return {
      onfocus: (event: FocusEvent) => this.focusField(path, row().line, field, event.currentTarget as HTMLTextAreaElement),
      oncompositionstart: () => { this.composing = true; },
      oncompositionend: (event: CompositionEvent) => {
        this.composing = false;
        // Some browsers send no input event after the composition ends; check the menu against
        // the committed text here.
        if (field === 'title') this.slashInput(path, row().line, event.currentTarget as HTMLTextAreaElement, null);
        this.scheduleSave();
      },
      oninput: (event: Event) => this.inputField(path, row().line, field, event.currentTarget as HTMLTextAreaElement, event as InputEvent),
      onblur: (event: FocusEvent) => {
        // The blank lines kept at the end of a note while it was typed in are not in the file.
        if (field === 'note') {
          const node = event.currentTarget as HTMLTextAreaElement;
          node.value = noteText(node.value);
        }
        this.blurField();
      },
      onkeydown: (event: KeyboardEvent) => this.keydownField(path, row(), field, event.currentTarget as HTMLTextAreaElement, event),
    };
  }

  private inputField(path: string, line: number, field: Field, node: HTMLTextAreaElement, event: InputEvent | null) {
    if (field === 'title' && /[\r\n]/.test(node.value)) {
      const position = node.selectionStart;
      const prefix = node.value.slice(0, position).replace(/[\r\n]+/g, ' ');
      node.value = node.value.replace(/[\r\n]+/g, ' ');
      node.setSelectionRange(prefix.length, prefix.length);
    }
    // One undo step covers a run of typing in one control until the next render.
    if (this.recorded.get(node) !== this.renderCount) {
      this.remember();
      this.recorded.set(node, this.renderCount);
    }
    this.inputEdit(path, line, field, node.value);
    if (field === 'note') node.rows = Math.max(1, Math.min(8, node.value.split('\n').length));
    else {
      this.fitTitle(node);
      this.slashInput(path, line, node, event);
    }
  }

  private blurField() {
    if (this.rendering) return;
    this.slash = null;
    this.active = null;
    this.composing = false;
    this.deferred = true;
    void this.poll();
  }

  private focusNote(path: string, line: number) {
    this.active = { path, line, field: 'note' };
    this.render();
  }

  private keydownField(path: string, row: KeyedRow, field: Field, node: HTMLTextAreaElement, event: KeyboardEvent) {
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
    if (event.isComposing || this.composing || event.keyCode === 229) return;
    if (field === 'title' && this.slash?.path === path && this.slash.line === row.line && this.slashKey(node, event)) return;
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.completeActive();
      return;
    }
    if (field === 'note') {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        this.toggleNote(path, row.line, field);
      }
      return;
    }
    const collapsedSelection = node.selectionStart === node.selectionEnd;
    const atStart = event.key === 'Backspace' && node.selectionStart === 0;
    const atEnd = event.key === 'Delete' && node.selectionEnd === node.value.length;
    const zoomRoot = this.zoomRoot(path);
    if (zoomRoot && row.line === zoomRoot.line) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) this.toggleNote(path, row.line, field);
        else this.add(path, row.line, true);
        return;
      }
      if (collapsedSelection && (atStart || atEnd)) return;
    }
    if (collapsedSelection && (atStart || atEnd) && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (zoomRoot) {
        const rows = this.rows(path);
        const neighbor = rows[rows.findIndex(value => value.line === row.line) + (atStart ? -1 : 1)];
        if (!neighbor || neighbor.line <= zoomRoot.line || neighbor.line >= zoomRoot.end) return;
      }
      this.merge(path, row, atStart);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) this.toggleNote(path, row.line, field);
      else if (collapsedSelection && node.selectionStart === 0 && node.value && !event.altKey) this.addAbove(path, row);
      else this.add(path, row.line, false);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.shift(path, row, event.shiftKey, field);
    } else if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      this.moveItem(path, row, event.key === 'ArrowUp' ? 'up' : 'down', field);
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      const titles = [...this.container!.querySelectorAll<HTMLTextAreaElement>('[data-field="title"]')];
      const next = titles[titles.indexOf(node) + (event.key === 'ArrowUp' ? -1 : 1)];
      if (next) {
        const column = node.selectionStart;
        next.focus();
        next.setSelectionRange(Math.min(column, next.value.length), Math.min(column, next.value.length));
        next.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // --- Item commands shared by the keyboard and the touch bar --------------------------------

  private zoomRoot(path: string) {
    const zoom = this.zoom;
    return zoom?.path === path ? this.rows(path).find(value => value.line === zoom.line) ?? null : null;
  }

  // Tab / Shift+Tab. The zoomed item and its direct children keep their level.
  private shift(path: string, row: KeyedRow, outdent: boolean, field: Field) {
    const zoomRoot = this.zoomRoot(path);
    if (zoomRoot && (row.line === zoomRoot.line || outdent && row.parentLine === zoomRoot.line)) return;
    this.mutate(path, text => outdent ? core.outdent(text, row.line) : core.indent(text, row.line), field);
  }

  // Alt+Up / Alt+Down. The zoomed item stays in place.
  private moveItem(path: string, row: KeyedRow, direction: 'up' | 'down', field: Field) {
    if (this.zoomRoot(path)?.line === row.line) return;
    this.mutate(path, text => core.move(text, row.line, direction), field);
  }

  // Shift+Enter: from the title to the note of the same item and back.
  private toggleNote(path: string, line: number, field: Field) {
    if (field === 'title') { this.focusNote(path, line); return; }
    this.active = { path, line, field: 'title' };
    this.render();
  }

  // Runs a touch bar command on the item whose field has focus. A soft keyboard keeps the word
  // being typed in IME composition, and render() waits for the composition to end; blurring the
  // field commits the word first. The field gets the focus back unless the command's render()
  // already focused it.
  private fromTouchBar(command: (path: string, row: KeyedRow, field: Field) => void) {
    const focus = this.active;
    const node = this.activeElement;
    if (!focus || !(node instanceof HTMLTextAreaElement)) return;
    if (this.composing) node.blur();
    const row = this.rows(focus.path).find(value => value.line === focus.line);
    if (row) command(focus.path, row, focus.field);
    if (node.isConnected && !(this.activeElement instanceof HTMLTextAreaElement)) node.focus();
  }

  indentActive = (outdent: boolean) => this.fromTouchBar((path, row, field) => this.shift(path, row, outdent, field));
  moveActive = (direction: 'up' | 'down') => this.fromTouchBar((path, row, field) => this.moveItem(path, row, direction, field));
  toggleActiveNote = () => this.fromTouchBar((path, row, field) => this.toggleNote(path, row.line, field));
  historyFromTouchBar = (back: boolean) => this.fromTouchBar(() => this.history(back));
  // Same order as the status button: not started → in progress → done → not started.
  cycleActiveStatus = () => this.fromTouchBar((path, row, field) => {
    const status = row.kind === 'task' ? row.status : null;
    if (status) this.mutate(path, text => core.updateStatus(text, row.line, nextStatus(status)), field);
  });

  // --- The `/` and `#` menus -----------------------------------------------------------------

  // Opens, filters or closes the menu after input in a title. Only an ASCII `/` or `#` typed at
  // the start or after whitespace opens it, so `A/B`, URLs and paths do not, and never an IME:
  // neither its full-width `／` or `＃` nor the input events that commit a composition.
  private slashInput(path: string, line: number, node: HTMLTextAreaElement, event: InputEvent | null) {
    const value = node.value, caret = node.selectionStart;
    const slash = this.slash;
    if (slash?.path === path && slash.line === line && (this.composing || event?.isComposing)) {
      // While an IME converts, the clause being converted is selected, so the caret rules below do
      // not hold. The query runs to the end of the selection; the menu is checked again when the
      // composition ends.
      const end = node.selectionEnd, query = value.slice(slash.start + 1, end);
      if (value[slash.start] === trigger(slash) && end > slash.start && !/\s/.test(query) && query !== slash.query) {
        slash.query = query;
        slash.index = 0;
      }
      return;
    }
    if (slash?.path === path && slash.line === line) {
      const query = value.slice(slash.start + 1, caret);
      if (value[slash.start] === trigger(slash) && caret > slash.start && node.selectionEnd === caret && !/\s/.test(query)) {
        if (query !== slash.query) { slash.query = query; slash.index = 0; }
        return;
      }
      this.slash = null;
    }
    if (event?.inputType !== 'insertText' || (event.data !== '/' && event.data !== '#') || event.isComposing || this.composing) return;
    if (value[caret - 1] === event.data && (caret === 1 || /\s/.test(value[caret - 2]))) {
      const start = caret - 1;
      if (event.data === '/') {
        this.slash = { path, line, start, query: '', step: 'commands', index: 0, files: [], tags: [] };
        return;
      }
      // Without the `#` just typed, so that text right after it (`#|word`) is not offered as a tag.
      const typed = core.updateTitle(this.docs.get(path)!.text, line, value.slice(0, start) + value.slice(caret)).text;
      const loaded = [...this.docs].flatMap(([key, doc]) => core.tagsIn(key === path ? typed : doc.text));
      this.slash = { path, line, start, query: '', step: 'tags', index: 0, files: [], tags: sortTags(loaded) };
      this.adapter.tags?.().then(tags => {
        const current = this.slash;
        if (current?.step === 'tags' && current.path === path && current.line === line && current.start === start) current.tags = sortTags([...current.tags, ...tags]);
      }).catch((error: unknown) => this.showToast(this.describe(error)));
    }
  }

  private slashOptions(slash: Slash) {
    if (slash.step === 'tags') {
      // Tags starting with the query come first, then the ones containing it, each alphabetically.
      const query = foldKana(slash.query);
      const folded = slash.tags.map(tag => ({ tag, folded: foldKana(tag) }));
      const matches = [
        ...folded.filter(({ folded }) => folded.startsWith(query)),
        ...folded.filter(({ folded }) => !folded.startsWith(query) && folded.includes(query)),
      ].map(({ tag }) => tag);
      // A tag typed out in full is no suggestion on its own: the menu closes and Enter stays Enter.
      if (matches.length === 1 && matches[0] === slash.query) return [];
      return matches.map(tag => ({ id: tag, label: '#' + tag }));
    }
    const query = slash.step === 'files' ? slash.query.toLowerCase() : foldKana(slash.query);
    if (slash.step === 'files') {
      return slash.files.filter(file => file !== slash.path && file.toLowerCase().includes(query)).map(file => ({ id: file, label: file }));
    }
    const row = this.rows(slash.path).find(value => value.line === slash.line);
    if (!row) return [];
    const zoomed = this.zoomRoot(slash.path)?.line === row.line;
    // Status commands also turn a bullet into a task, as core.updateStatus does.
    const commands = (Object.keys(this.t.slash.command) as SlashCommand[]).filter(command =>
      !(command === 'task' && row.kind === 'task' || command === 'bullet' && row.kind !== 'task' || command === 'zoom' && zoomed));
    return commands
      .filter(command => [messages.en, messages.ja].some(({ slash }) => foldKana(slash.command[command].label + ' ' + slash.command[command].keywords).includes(query)))
      .map(command => ({ id: command, label: this.t.slash.command[command].label }));
  }

  // The open menu of a title, or null. A menu without matches is not shown, and Enter stays Enter.
  slashMenu(path: string, line: number): SlashMenu | null {
    const slash = this.slash;
    if (slash?.path !== path || slash.line !== line) return null;
    const options = this.slashOptions(slash);
    if (!options.length) return null;
    const label = slash.step === 'files' ? this.t.slash.files : slash.step === 'tags' ? this.t.slash.tags : this.t.slash.commands;
    return { id: this.slashId, label, options, index: Math.min(slash.index, options.length - 1) };
  }

  // Returns whether the key was used by the menu.
  private slashKey(node: HTMLTextAreaElement, event: KeyboardEvent) {
    const slash = this.slash!;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      // The typed text stays; from the file list Escape goes back to the commands.
      if (slash.step === 'files') { slash.step = 'commands'; slash.index = 0; }
      else this.slash = null;
      return true;
    }
    const options = this.slashOptions(slash);
    if (!options.length || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      slash.index = (Math.min(slash.index, options.length - 1) + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      void this.runSlash(options[Math.min(slash.index, options.length - 1)].id, node);
      return true;
    }
    return false;
  }

  private titleNode(path: string, line: number) {
    return [...this.container!.querySelectorAll<HTMLTextAreaElement>('[data-field="title"]')]
      .find(node => node.dataset.path === path && Number(node.dataset.line) === line) ?? null;
  }

  // Runs a command of the menu on its item. The `/query` text is removed in the same undo step as
  // the command where the command edits the text; zoom and the note do not, and extracting to a
  // file clears the undo history anyway.
  runSlash = async (id: string, node = this.slash && this.titleNode(this.slash.path, this.slash.line)) => {
    const slash = this.slash;
    if (!slash || !node) return;
    const { path, line, start } = slash;
    // A tap during an IME composition commits the word first, as the touch bar does.
    if (this.composing) node.blur();
    const value = node.value, end = Math.max(start + 1, node.selectionStart);
    if (value[start] !== trigger(slash)) { this.slash = null; return; }
    if (slash.step === 'tags') {
      // `#query` becomes `#tag` and a space, unless whitespace follows already; the caret goes after it.
      const rest = value.slice(end), tag = '#' + id + (/^\s/.test(rest) ? '' : ' ');
      const caret = start + tag.length + (/^\s/.test(rest) ? 1 : 0);
      // mutate does not render when the text stays the same (the tag was typed out before a space).
      this.slash = null;
      this.mutate(path, text => core.updateTitle(text, line, value.slice(0, start) + tag + rest), 'title');
      const focused = this.activeElement instanceof HTMLTextAreaElement && this.activeElement.dataset.field === 'title' ? this.activeElement : node;
      if (focused.isConnected) {
        if (this.activeElement !== focused) focused.focus();
        focused.setSelectionRange(caret, caret);
      }
      return;
    }
    // At the end of the text, the space typed before the `/` goes too.
    const title = value.slice(end) ? value.slice(0, start) + value.slice(end) : value.slice(0, start).trimEnd();
    const strip = (text: string) => core.updateTitle(text, line, title).text;
    const mutateTitle = (fn: (text: string) => core.EditResult) => {
      this.mutate(path, fn, 'title');
      const focused = this.activeElement;
      if (focused instanceof HTMLTextAreaElement && focused.dataset.field === 'title') focused.setSelectionRange(start, start);
    };
    if (slash.step === 'files') {
      const name = relativePath(path, id);
      let replaced = false;
      this.mutate(path, text => {
        const result = core.embedFile(strip(text), line, name);
        replaced = result.line === line;
        return result;
      }, null);
      if (!replaced) this.active = { path, line, field: 'title' };
      await this.loadEmbeds(path);
      this.render();
      return;
    }
    const command = id as SlashCommand;
    if (command === 'embed') {
      // The file list is filtered by what is typed after the same `/`.
      node.value = value.slice(0, start + 1) + value.slice(end);
      node.setSelectionRange(start + 1, start + 1);
      this.inputField(path, line, 'title', node, null);
      if (!node.isConnected) return;
      if (this.activeElement !== node) node.focus();
      this.slash = { ...slash, step: 'files', query: '', index: 0, files: [...this.fileList] };
      this.adapter.list().then(list => { if (this.slash?.step === 'files' && this.slash.path === path && this.slash.line === line) this.slash.files = list; })
        .catch((error: unknown) => this.showToast(this.describe(error)));
      return;
    }
    if (command === 'todo' || command === 'in-progress' || command === 'done') mutateTitle(text => core.updateStatus(strip(text), line, command));
    else if (command === 'task') mutateTitle(text => core.updateStatus(strip(text), line, 'todo'));
    else if (command === 'bullet') mutateTitle(text => core.toBullet(strip(text), line));
    else {
      mutateTitle(text => core.updateTitle(text, line, title));
      if (command === 'note') this.focusNote(path, line);
      else if (command === 'zoom') this.zoomTo(path, line);
      else await this.extractToFile(path, line);
    }
    if (node.isConnected && !(this.activeElement instanceof HTMLTextAreaElement)) node.focus();
  };

  // --- Row actions --------------------------------------------------------------------------

  setStatus = (path: string, line: number, status: Status) => this.mutate(path, text => core.updateStatus(text, line, status), 'title');
  moveRow = (path: string, line: number, direction: 'up' | 'down') => this.mutate(path, text => core.move(text, line, direction), 'title');
  showNote = (path: string, line: number) => this.focusNote(path, line);

  toggleFold = (path: string, line: number) => {
    const id = this.key(path, line);
    if (this.collapsed.has(id)) this.collapsed.delete(id); else this.collapsed.add(id);
    this.active = null;
    this.render();
  };

  zoomTo = (path: string, line: number) => {
    this.zoom = { path, line };
    this.collapsed.delete(this.key(path, line));
    this.active = null;
    this.render();
  };

  zoomOut = () => {
    this.zoom = null;
    this.active = null;
    this.render();
  };

  private query(): FilterQuery {
    return { status: this.filter, tags: this.tagList(), text: this.textSearch.trim() };
  }

  // The lines to show, each mapped to whether the row matches the filter itself (true) or is shown
  // only as an ancestor of a match (false). An embed matches when anything in its file matches.
  // `chain` holds the files embedding this one, as in outlineView(), to stop at cycles.
  private shown(path: string, text: string, chain: string[] = []): Map<number, boolean> {
    const query = this.query(), active = filterActive(query);
    const rows = this.rows(path, text);
    const byLine = new Map(rows.map(row => [row.line, row]));
    const keptLines = new Set(this.keepFor(path));
    const shown = new Map<number, boolean>();
    for (const row of rows) {
      const matches = !active || keptLines.has(row.line)
        || (row.kind === 'embed' ? this.embedMatches(path, row, chain) : rowMatches(row, query));
      if (!matches) continue;
      shown.set(row.line, true);
      // Ancestors come before their descendants, so an ancestor already shown has its own ancestors shown too.
      for (let ancestor = row.parentLine === null ? undefined : byLine.get(row.parentLine); ancestor && !shown.has(ancestor.line);
        ancestor = ancestor.parentLine === null ? undefined : byLine.get(ancestor.parentLine)) {
        shown.set(ancestor.line, false);
      }
    }
    return shown;
  }

  // Whether anything in the embedded file matches the filter. A cycle, an invalid path or a file
  // that is not loaded has nothing to match.
  private embedMatches(path: string, row: KeyedRow, chain: string[]) {
    let target: string;
    try { target = this.normalize(path, row.embed); }
    catch { return false; }
    const doc = this.docs.get(target);
    if (!doc || chain.includes(target) || target === path) return false;
    return [...this.shown(target, doc.text, [...chain, path]).values()].some(Boolean);
  }

  selectRow = (path: string, row: KeyedRow, event: MouseEvent) => {
    const rows = this.rows(path);
    const previous = rows.find(value => this.selectedLines.has(value.line));
    if (this.selectedPath !== path || previous && previous.parentLine !== row.parentLine || !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      this.clearSelection();
      this.selectedPath = path;
    }
    const anchor = this.selectionAnchor;
    if (event.shiftKey && anchor !== null) {
      const visible = this.shown(path, this.docs.get(path)!.text);
      for (const sibling of rows) {
        if (sibling.parentLine === row.parentLine && visible.has(sibling.line) && sibling.line >= Math.min(anchor, row.line) && sibling.line <= Math.max(anchor, row.line)) this.selectedLines.add(sibling.line);
      }
    } else {
      if (this.selectedLines.has(row.line)) this.selectedLines.delete(row.line); else this.selectedLines.add(row.line);
      this.selectionAnchor = row.line;
    }
    this.active = null;
    this.render();
  };

  private reorderSelection(path: string, target: number, position: 'before' | 'after') {
    if (this.selectedPath !== path || !this.selectedLines.size) return;
    let result: ReturnType<typeof core.reorder> | undefined;
    const lines = [...this.selectedLines];
    this.mutate(path, text => {
      result = core.reorder(text, lines, target, position);
      return result;
    }, 'title');
    if (result) {
      this.selectedPath = path;
      this.selectedLines = new Set(result.lines);
      this.selectionAnchor = result.line;
      this.render();
    }
  }

  moveSelection = (down: boolean) => {
    const path = this.selectedPath!;
    const rows = this.rows(path);
    const selected = rows.filter(row => this.selectedLines.has(row.line));
    const siblings = rows.filter(row => row.parentLine === selected[0].parentLine);
    const edge = down ? selected[selected.length - 1] : selected[0];
    const target = siblings[siblings.indexOf(edge) + (down ? 1 : -1)];
    if (target) this.reorderSelection(path, target.line, down ? 'after' : 'before');
  };

  setSelectionStatus = (status: Status) => {
    const path = this.selectedPath!;
    const lines = [...this.selectedLines];
    this.mutate(path, text => {
      let result: core.EditResult = { text, line: lines[0] };
      for (const value of lines) if (this.rows(path, result.text).find(row => row.line === value)?.kind === 'task') result = core.updateStatus(result.text, value, status);
      return result;
    }, 'title');
  };

  // Alt+Up / Alt+Down on a focused handle. This is how an embed line, which has no text field, moves
  // from the keyboard. A selection that includes the row moves as a whole.
  handleKeydown = (path: string, row: KeyedRow, event: KeyboardEvent) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const down = event.key === 'ArrowDown';
    const sortedSelection = () => [...this.selectedLines].sort((a, b) => a - b);
    let line = row.line;
    if (this.selectedPath === path && this.selectedLines.has(row.line)) {
      const index = sortedSelection().indexOf(row.line);
      this.moveSelection(down);
      line = sortedSelection()[index];
    } else {
      this.mutate(path, text => {
        const result = core.move(text, row.line, down ? 'down' : 'up');
        line = result.line;
        return result;
      }, null);
    }
    // The re-render may have moved or replaced the focused handle.
    [...this.container!.querySelectorAll<HTMLElement>('.drag-handle')].find(node => node.dataset.path === path && Number(node.dataset.line) === line)?.focus();
  };

  clearSelectionAndRender = () => {
    this.clearSelection();
    this.render();
  };

  // --- Drag and drop ------------------------------------------------------------------------

  dragStart(path: string, row: KeyedRow, event: DragEvent) {
    const lines = this.selectedPath === path && this.selectedLines.has(row.line) ? [...this.selectedLines] : [row.line];
    this.dragging = { path, lines };
    this.container!.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.title);
    }
  }

  dragEnd = () => {
    this.dragging = null;
    this.container!.classList.remove('is-dragging');
    this.clearDrop();
  };

  clearDrop = () => {
    for (const node of this.container!.querySelectorAll('.drop-before, .drop-after, .drop-child')) node.classList.remove('drop-before', 'drop-after', 'drop-child');
  };

  // Computes where a row line accepts the dragged items from the pointer position.
  lineDrop(path: string, line: number, rootLine: number | null, node: HTMLElement, event: DragEvent): Drop | null {
    const rows = this.rows(path);
    const byLine = new Map(rows.map(value => [value.line, value]));
    const row = byLine.get(line);
    if (!row) return null;
    const hasChildren = rows.some(child => child.parentLine === row.line);
    const bounds = node.getBoundingClientRect();
    const fraction = (event.clientY - bounds.top) / bounds.height;
    // An embed line has no text field; the embed's name starts where an item's title would.
    const titleLeft = node.querySelector('.title-input, .embed-title')!.getBoundingClientRect().left;
    // Nothing goes under an embed line (core.reparent refuses it), so it only takes drops before and after.
    if (row.kind !== 'embed' && !hasChildren && fraction >= .25 && fraction <= .75 && event.clientX >= titleLeft) {
      return { parentLine: row.line, beforeLine: null, indicator: 'drop-child', offset: 24 };
    }
    const position = fraction < .5 ? 'before' : 'after';
    let targetRow = row;
    let offset = 0;
    while (targetRow.parentLine !== null && targetRow.parentLine !== rootLine && event.clientX < titleLeft + offset - 12) {
      targetRow = byLine.get(targetRow.parentLine)!;
      offset -= 24;
    }
    const siblings = rows.filter(candidate => candidate.parentLine === targetRow.parentLine);
    const beforeLine = position === 'before' ? targetRow.line : siblings[siblings.indexOf(targetRow) + 1]?.line ?? null;
    return { parentLine: targetRow.parentLine, beforeLine, line: targetRow.line, position, indicator: position === 'before' ? 'drop-before' : 'drop-after', offset };
  }

  dragOver(path: string, node: HTMLElement, event: DragEvent, destination: (event: DragEvent) => Drop | null) {
    if (!this.dragging || this.dragging.path !== path) return;
    const drop = destination(event);
    if (!drop) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.clearDrop();
    node.style.setProperty('--drop-offset', (drop.offset || 0) + 'px');
    node.classList.add(drop.indicator);
  }

  drop(path: string, event: DragEvent, destination: (event: DragEvent) => Drop | null) {
    if (!this.dragging || this.dragging.path !== path) return;
    const drop = destination(event);
    if (!drop) return;
    event.preventDefault();
    const lines = [...this.dragging.lines];
    const byLine = new Map(this.rows(path).map(row => [row.line, row]));
    this.dragEnd();
    if (drop.parentLine !== null || lines.some(value => byLine.get(value)?.parentLine !== null)) {
      this.mutate(path, text => {
        const result = core.reparent(text, lines, drop.parentLine, drop.beforeLine);
        if (drop.parentLine !== null) this.collapsed.delete(this.key(path, drop.parentLine));
        return result;
      }, 'title');
    } else {
      this.selectedPath = path;
      this.selectedLines = new Set(lines);
      this.reorderSelection(path, drop.line!, drop.position!);
    }
  }

  // --- Toolbar ------------------------------------------------------------------------------

  setFilter = (value: StatusFilter) => {
    this.filter = value;
    this.kept.clear();
    this.active = null;
    this.render();
  };

  searchInput = (value: string) => {
    this.parseSearch(value);
    this.updateStar();
  };

  applySearch = (value: string) => {
    this.parseSearch(value);
    this.kept.clear();
    this.active = null;
    this.render();
  };

  // Adds a tag to the search as if typed and applied; a tag already in the search is left as is.
  filterByTag = (tag: string) => {
    if (!this.tagList().includes(tag)) this.applySearch(this.searchValue() + ' #' + tag);
  };

  reset = () => {
    this.filter = 'all';
    this.tags = '';
    this.textSearch = '';
    this.kept.clear();
    this.active = null;
    this.render();
  };

  setAutoSave = (value: boolean) => {
    this.autoSave = value;
    this.scheduleSave();
  };

  openSource = async () => {
    const path = this.zoom ? this.zoom.path : this.current;
    if (path === null) return;
    try { await this.adapter.openSource!(path); }
    catch (error) { this.message = this.describe(error); this.render(); }
  };

  copyConflict = (path: string, node: HTMLTextAreaElement) => {
    node.focus();
    node.select();
    const text = this.docs.get(path)!.text;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => { this.message = this.t.conflict.selectedForCopy; });
  };

  openExternal = async (path: string) => {
    try {
      const result = await this.adapter.read(path);
      this.remember();
      this.docs.set(path, { text: result.text, baseText: result.text, baseRevision: result.revision, dirty: false, conflict: false });
      this.clearSelection();
      this.message = '';
      this.active = null;
      this.render();
    } catch (error) { this.message = this.describe(error); this.render(); }
  };

  // Takes one side for every conflicting line and keeps the changes of both sides that merged
  // cleanly. The result is saved like any edit, against the revision of the external version.
  resolveConflict = (path: string, side: Side) => {
    const doc = this.docs.get(path)!;
    const external = doc.external!;
    this.replaceText(path, doc, merge3(doc.baseText, doc.text, external.text).text(side), external);
    this.message = '';
    this.scheduleSave();
    this.render();
  };

  // --- Bookmarks ----------------------------------------------------------------------------

  private persistPreferences() {
    const save = this.savePreferences;
    if (!save) return;
    const snapshot = JSON.parse(JSON.stringify(this.preferences)) as Preferences;
    this.preferenceSave = this.preferenceSave.then(() => save(snapshot)).catch((error: unknown) => {
      if (!this.destroyed) this.showToast(this.t.bookmarks.saveFailed(this.describe(error)));
    });
  }

  addBookmark = () => {
    if (this.current === null) return;
    if (!Array.isArray(this.preferences.bookmarks)) {
      this.showToast(this.t.bookmarks.listUnreadable);
      return;
    }
    const view = this.currentView()!;
    // One bookmark per view: the star in the search box shows and removes the bookmark of the
    // current view, which would be ambiguous with duplicates.
    if (this.currentViewBookmark()) {
      this.showToast(this.t.bookmarks.exists);
      return;
    }
    const bookmark: Bookmark = {
      id: crypto.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2), kind: 'view',
      file: view.file, status: view.status, tags: view.tags, searchText: view.searchText, ...(view.zoom ? { zoom: view.zoom } : {}),
    };
    this.preferences.bookmarks.push(bookmark);
    this.persistPreferences();
    this.render();
  };

  private currentView(): SavedView | null {
    if (this.current === null) return null;
    const zoom = this.zoom;
    const zoomRow = zoom && this.docs.has(zoom.path) ? this.rows(zoom.path).find(row => row.line === zoom.line) : undefined;
    return {
      file: this.current, status: this.filter, tags: this.tagList(), searchText: this.textSearch.trim(),
      zoom: zoom && zoomRow ? { path: zoom.path, line: zoom.line, title: zoomRow.title } : null,
    };
  }

  private currentViewBookmark() {
    const view = this.currentView();
    return view && Array.isArray(this.preferences.bookmarks)
      ? this.preferences.bookmarks.find(saved => validBookmark(saved) && sameView(savedView(saved), view)) : undefined;
  }

  private updateStar() {
    this.searchSaved = !!this.currentViewBookmark();
  }

  toggleSearchBookmark = () => {
    const existing = this.currentViewBookmark();
    if (existing) {
      this.preferences.bookmarks.splice(this.preferences.bookmarks.indexOf(existing), 1);
      this.persistPreferences();
      this.render();
    } else this.addBookmark();
  };

  // An empty name removes the custom name, so the label is derived from the view again.
  renameBookmark = (bookmark: unknown, name: string) => {
    if (!validBookmark(bookmark)) { this.showToast(this.t.bookmarks.invalid); return; }
    const trimmed = name.trim();
    if (trimmed) bookmark.name = trimmed;
    else delete bookmark.name;
    this.persistPreferences();
    this.render();
  };

  removeBookmark = (bookmark: unknown) => {
    this.preferences.bookmarks.splice(this.preferences.bookmarks.indexOf(bookmark), 1);
    this.persistPreferences();
    this.render();
  };

  toggleSidebar = () => {
    this.preferences.sidebarCollapsed = this.preferences.sidebarCollapsed !== true;
    this.persistPreferences();
    this.render();
  };

  openBookmark = async (bookmark: unknown) => {
    if (!validBookmark(bookmark)) { this.showToast(this.t.bookmarks.invalid); return; }
    try { await this.loadEmbeds(bookmark.file); }
    catch (error) { this.showToast(this.t.bookmarks.openFailed(this.describe(error))); return; }
    if (this.destroyed) return;
    const view = savedView(bookmark);
    this.filter = view.status;
    this.tags = view.tags.map(tag => '#' + tag).join(' ');
    this.textSearch = view.searchText;
    this.kept.clear();
    await this.openFile(view.file);
    if (this.destroyed || !view.zoom || this.current !== view.file) return;
    const zoom = view.zoom;
    const rows = this.docs.has(zoom.path) ? this.rows(zoom.path).filter(row => row.title === zoom.title) : [];
    const nearest = rows.sort((a, b) => Math.abs(a.line - zoom.line) - Math.abs(b.line - zoom.line)).at(0);
    if (!nearest) { this.showToast(this.t.bookmarks.zoomMissing(zoom.title)); return; }
    this.zoomTo(zoom.path, nearest.line);
  };

  private bookmarkViews(): BookmarkView[] {
    return this.preferences.bookmarks.map(bookmark => {
      if (!validBookmark(bookmark)) return { bookmark, label: this.t.bookmarks.unreadableLabel, title: this.t.bookmarks.unreadableLabel, defaultLabel: '' };
      const view = savedView(bookmark);
      const filename = view.file.split('/').pop()!;
      const filtered = view.status !== 'all' || view.tags.length > 0 || view.searchText !== '';
      const base = filtered || bookmark.kind === 'search'
        ? this.t.bookmarks.searchLabel(this.t.filter[view.status], view.tags.map(tag => '#' + tag).join(' '), view.searchText, filename)
        : filename;
      const defaultLabel = view.zoom ? this.t.bookmarks.zoomLabel(base, view.zoom.title) : base;
      return { bookmark, label: bookmark.name ?? defaultLabel, title: view.file, defaultLabel };
    });
  }

  // --- Rendering ----------------------------------------------------------------------------

  private updateStatus() {
    const docs = [...this.docs.values()];
    const dirty = docs.filter(doc => doc.dirty).length;
    const conflicts = docs.filter(doc => doc.conflict).length;
    this.saveState = {
      text: this.busy ? this.t.saveState.busy : conflicts ? this.t.saveState.conflicts(conflicts) : dirty ? this.t.saveState.unsaved(dirty)
        : this.externalPending ? this.t.saveState.externalPending : this.t.saveState.saved,
      dirty: !!dirty,
    };
  }

  // Re-renders without moving focus, for line shifts caused by typing.
  private refresh() {
    if (this.composing) { this.deferred = true; return; }
    this.version++;
    flushSync();
  }

  render() {
    if (this.destroyed) return;
    if (this.composing) { this.deferred = true; return; }
    this.deferred = false;
    // Every command ends in a render; any other render may move or remove the line the menu is on.
    this.slash = null;
    const focus = this.active && { ...this.active };
    const focusRoot = this.focusRootAfterRender;
    this.focusRootAfterRender = false;
    const oldNode = this.activeElement;
    const selection = oldNode instanceof HTMLTextAreaElement || oldNode instanceof HTMLInputElement && typeof oldNode.selectionStart === 'number'
      ? [oldNode.selectionStart ?? 0, oldNode.selectionEnd ?? 0] : null;
    // Moving a focused node blurs it; those blurs are not the user leaving the field.
    this.rendering = true;
    try {
      this.notice = this.message;
      this.updateStar();
      this.renderCount++;
      this.version++;
      flushSync();
      this.updateStatus();
      const container = this.container!;
      for (const node of container.querySelectorAll<HTMLTextAreaElement>('.title-input')) this.fitTitle(node);
      const target = focus && [...container.querySelectorAll<HTMLTextAreaElement>('[data-field]')]
        .find(node => node.dataset.path === focus.path && Number(node.dataset.line) === focus.line && node.dataset.field === focus.field);
      if (target) {
        target.focus();
        if (selection) target.setSelectionRange(Math.min(selection[0], target.value.length), Math.min(selection[1], target.value.length));
      } else {
        const focused = this.activeElement;
        if (focused instanceof HTMLTextAreaElement && container.contains(focused) && focused.dataset.field) {
          // A field that kept its node across the render is still being edited.
          this.active = { path: focused.dataset.path!, line: Number(focused.dataset.line), field: focused.dataset.field as Field };
        } else if (focusRoot && !container.contains(focused)) {
          // Keeps keyboard shortcuts working after undo or redo removed the focused field.
          container.querySelector<HTMLElement>('.outliner-workspace')?.focus();
        }
      }
    } finally {
      this.rendering = false;
    }
  }

  view(): View {
    // Reading the version makes every derived view re-run on render().
    void this.version;
    const outline = this.current !== null && this.docs.has(this.current) ? this.outlineView(this.zoom ? this.zoom.path : this.current) : null;
    return {
      fileList: [...this.fileList],
      current: this.current,
      noFiles: this.noFiles,
      filter: this.filter,
      searchValue: this.searchValue(),
      canOpenSource: !!this.adapter.openSource,
      autoSave: this.autoSave,
      selectionCount: this.selectedLines.size,
      zoomPath: this.zoom ? this.zoom.path : null,
      conflicts: [...this.docs].filter(([, doc]) => doc.conflict).map(([path, doc]) => ({
        path,
        text: doc.text,
        hunks: doc.external?.conflicts.map(conflict => ({ ours: shownLines(conflict.ours), theirs: shownLines(conflict.theirs) })) ?? null,
      })),
      outline,
      sidebarCollapsed: this.preferences.sidebarCollapsed === true,
      bookmarksValid: Array.isArray(this.preferences.bookmarks),
      bookmarks: Array.isArray(this.preferences.bookmarks) ? this.bookmarkViews() : [],
    };
  }

  private statusView(row: KeyedRow, zoomed: boolean) {
    if (row.kind !== 'task' || !row.status) return null;
    const next = nextStatus(row.status);
    const label = zoomed ? this.t.zoomStatusButton(next) : this.t.statusButton(row.status, next);
    return { icon: statusIcons[row.status], label, next };
  }

  private isActive(path: string, line: number, field: Field) {
    return !!this.active && this.active.path === path && this.active.line === line && this.active.field === field;
  }

  private outlineView(path: string, chain: string[] = []): OutlineView {
    if (chain.includes(path)) return { kind: 'cycle', path };
    const doc = this.docs.get(path);
    if (!doc) return { kind: 'missing' };
    const rows = this.rows(path, doc.text);
    const visible = this.shown(path, doc.text, chain);
    const query = this.query();
    const highlight = query.text || query.tags.length ? { text: query.text, tags: query.tags } : null;
    const byLine = new Map(rows.map(row => [row.line, row]));
    const zoom = this.zoom;
    const rootRow = zoom && zoom.path === path ? byLine.get(zoom.line) ?? null : null;
    const baseDepth = rootRow ? rootRow.depth + 1 : 0;
    const items: ItemView[] = [];
    const itemByLine = new Map<number, ItemView>();
    for (const row of rows) {
      if (rootRow && !(row.line > rootRow.line && row.line < rootRow.end)) continue;
      if (!visible.has(row.line)) continue;
      let hidden = false;
      for (let ancestor = row.parentLine === null ? undefined : byLine.get(row.parentLine); ancestor; ancestor = ancestor.parentLine === null ? undefined : byLine.get(ancestor.parentLine)) {
        if (this.collapsed.has(this.key(path, ancestor.line))) { hidden = true; break; }
      }
      if (hidden) continue;
      const collapsed = this.collapsed.has(this.key(path, row.line));
      const item: ItemView = {
        key: row.key,
        path,
        row,
        depth: Math.max(0, row.depth - baseDepth),
        rootLine: rootRow ? rootRow.line : null,
        selected: this.selectedPath === path && this.selectedLines.has(row.line),
        collapsed,
        hasChildren: rows.some(child => child.parentLine === row.line),
        showNote: row.kind !== 'embed' && (!!row.note || this.isActive(path, row.line, 'note')),
        status: this.statusView(row, false),
        context: visible.get(row.line) === false,
        // Context rows did not match, so any words they share with the query are not marked.
        highlight: visible.get(row.line) ? highlight : null,
        embed: null,
        ends: [],
      };
      if (row.kind === 'embed') {
        item.embed = { target: null, error: null, outline: null };
        if (!collapsed) {
          try {
            item.embed.target = this.normalize(path, row.embed);
            item.embed.outline = this.outlineView(item.embed.target, [...chain, path]);
          } catch (error) { item.embed.error = this.describe(error); }
        }
      }
      itemByLine.set(row.line, item);
      items.push(item);
    }
    for (const row of rows) {
      if (row.kind === 'embed' || !itemByLine.has(row.line) || !rows.some(child => child.parentLine === row.line)) continue;
      const descendants = rows.filter(child => child.line >= row.line && child.line < row.end && itemByLine.has(child.line));
      // Later (inner) rows go first, matching insertion right after the same item.
      itemByLine.get(descendants[descendants.length - 1].line)!.ends.unshift({
        key: 'end-' + row.key, parentLine: row.line, depth: Math.max(0, row.depth + 1 - baseDepth), label: this.t.item.childrenEnd(row.title),
      });
    }
    const siblings = rows.filter(row => row.parentLine === (rootRow ? rootRow.line : null));
    const last = siblings[siblings.length - 1];
    const editable = siblings.filter(row => row.kind !== 'embed');
    const lastEditable = editable[editable.length - 1];
    return {
      kind: 'outline',
      path,
      zoom: rootRow ? {
        row: rootRow,
        status: this.statusView(rootRow, true),
        showNote: !!rootRow.note || this.isActive(path, rootRow.line, 'note'),
      } : null,
      items,
      addKind: lastEditable?.kind === 'bullet' ? 'bullet' : 'task',
      appendLine: !rootRow ? null : last ? last.line : rootRow.line,
      appendChild: !!rootRow && !last,
    };
  }

  // --- Files --------------------------------------------------------------------------------

  openFile = async (path: string) => {
    this.current = path;
    this.clearSelection();
    this.zoom = null;
    this.active = null;
    this.message = '';
    this.render();
    try {
      await this.loadEmbeds(path);
      // Only a file that could be read joins the list and is remembered for the next start.
      if (!this.fileList.includes(path)) this.fileList.push(path);
      if (this.preferences.lastFile !== path) {
        this.preferences.lastFile = path;
        this.persistPreferences();
      }
    } catch (error) { this.message = this.describe(error); }
    this.render();
  };

  saveAll = async (automatic = false) => {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.updateStatus();
    let rerender = false;
    for (const [path, doc] of this.docs) {
      if (!doc.dirty || automatic === true && doc.conflict) continue;
      // A save rejected because the file changed elsewhere is retried after a clean merge. Each
      // retry checks the revision that was merged, so a further change in between is merged too,
      // up to SAVE_ATTEMPTS saves.
      for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
        const savingText = doc.text;
        try {
          const result = await this.adapter.save(path, savingText, doc.baseRevision);
          doc.baseText = savingText;
          doc.baseRevision = result.revision;
          doc.dirty = doc.text !== savingText;
          doc.conflict = false;
          doc.external = undefined;
          break;
        } catch (error) {
          if (attempt < SAVE_ATTEMPTS && await this.mergeOnRejection(path, doc)) { rerender = true; continue; }
          doc.conflict = true;
          rerender = true;
          this.message = this.t.edit.saveFailed(this.describe(error));
          break;
        }
      }
    }
    this.busy = false;
    if (this.message) this.notice = this.message;
    this.scheduleSave();
    // A merge moves lines and a conflict needs a decision, so either is rendered even while a field
    // is being edited; render() keeps the focus and the caret on the edited item.
    if (this.composing || this.active && !rerender) { this.deferred = true; this.updateStatus(); }
    else this.render();
  };

  // Merges the external version after a rejected save. Returns whether it merged cleanly.
  private async mergeOnRejection(path: string, doc: Doc) {
    let external: { text: string; revision: Revision };
    try { external = await this.adapter.read(path); }
    catch { return false; }
    // Merging under an IME composition would move the line being composed.
    if (!this.externalChange(doc, external) || this.composing) return false;
    return this.mergeExternal(path, doc, external);
  }

  reload = async () => {
    if (this.busy) return;
    this.message = '';
    let rerender = false;
    for (const [path, doc] of this.docs) {
      try {
        const result = await this.adapter.read(path);
        if (doc.dirty) {
          if (this.externalChange(doc, result) && !this.composing) { this.mergeExternal(path, doc, result); rerender = true; }
          this.message = this.t.edit.reloadKeptInput;
        } else {
          if (doc.text !== result.text) this.clearSelection();
          doc.text = result.text;
          doc.baseText = result.text;
          doc.baseRevision = result.revision;
        }
      } catch (error) { this.message = this.describe(error); }
    }
    if (this.current !== null) await this.loadEmbeds(this.current);
    if (this.composing || this.active && !rerender) { this.deferred = true; this.updateStatus(); } else this.render();
  };

  // Whether `result` is an external version not yet applied, merged or shown as a conflict.
  private externalChange(doc: Doc, result: { revision: Revision }) {
    return result.revision !== doc.baseRevision && result.revision !== doc.external?.revision;
  }

  // Whether the user may be typing: a field is being edited or a control of the outliner has focus.
  private editing() {
    const focused = this.activeElement;
    return !!this.active || !!focused && !!this.container?.contains(focused)
      && ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName) && (focused as HTMLInputElement).type !== 'checkbox';
  }

  // Called when the window gets focus or the browser tab is shown or hidden. Switching to another
  // tab or window keeps the focus in the field, so waiting for the user to leave the field would
  // defer an external change forever. Hiding the view with display: none, as a background
  // Obsidian tab is, blurs the field in Chromium, so blurField() already covers that case.
  private resume = () => {
    this.resumeRequested = true;
    void this.poll();
  };

  // Sets the text of a file after an external change, on top of the external version `base`,
  // keeping the edited item across lines added or removed above it. The undo history is cleared:
  // its snapshots lack the external lines, so undoing would silently remove them from the file.
  private replaceText(path: string, doc: Doc, text: string, base: { text: string; revision: Revision }) {
    const active = this.active;
    const activeRow = active?.path === path ? this.rows(path, doc.text).find(row => row.line === active.line) : undefined;
    this.clearSelection();
    this.undo.length = 0;
    this.redo.length = 0;
    if (this.zoom?.path === path) this.zoom = null;
    doc.text = text;
    doc.baseText = base.text;
    doc.baseRevision = base.revision;
    doc.dirty = text !== base.text;
    doc.conflict = false;
    doc.external = undefined;
    if (active && activeRow) {
      const row = this.rows(path, doc.text).find(value => value.key === activeRow.key);
      this.active = row ? { ...active, line: row.line } : null;
    }
  }

  // Merges an external version into a file with unsaved input. Changes to different lines are
  // combined and left unsaved, so the next save checks the revision of the external version.
  // Returns false when both sides changed the same lines; those are then shown as a conflict.
  private mergeExternal(path: string, doc: Doc, result: { text: string; revision: Revision }) {
    const merged = merge3(doc.baseText, doc.text, result.text);
    if (merged.conflicts.length) {
      doc.conflict = true;
      doc.external = { ...result, conflicts: merged.conflicts };
      return false;
    }
    this.replaceText(path, doc, merged.text('ours'), result);
    this.showToast(this.t.conflict.merged(path));
    return true;
  }

  private async poll() {
    if (this.destroyed || this.busy || this.polling) return;
    this.polling = true;
    // A resume request that arrives while this poll reads is handled by the next poll.
    const resume = this.resumeRequested;
    this.resumeRequested = false;
    let changed = false;
    let rerender = false;
    let pending = false;
    try {
      for (const [path, doc] of this.docs) {
        try {
          const result = await this.adapter.read(path);
          if (!this.externalChange(doc, result)) continue;
          if (this.composing) pending = true;
          // Unsaved input is merged right away: waiting would only let the next save fail.
          else if (doc.dirty) {
            this.mergeExternal(path, doc, result);
            rerender = true;
            changed = true;
          } else if (!resume && this.editing()) pending = true;
          else {
            this.replaceText(path, doc, result.text, result);
            changed = true;
          }
        } catch (error) { if (this.message !== this.describe(error)) changed = true; this.message = this.describe(error); }
      }
      this.externalPending = pending;
      const editing = this.editing();
      if (changed || this.deferred && !editing) {
        if (this.current !== null) await this.loadEmbeds(this.current);
        // render() puts the focus and the caret back on the edited item. A merge moves lines and a
        // conflict needs a decision, so either is rendered even while a field is being edited.
        if (this.composing || editing && !resume && !rerender) { this.deferred = true; } else this.render();
      }
    } finally { this.polling = false; this.updateStatus(); }
  }

  keyboard = (event: KeyboardEvent) => {
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
    if (event.isComposing || this.composing || event.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.history(!event.shiftKey);
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.saveAll();
    }
  };
}
