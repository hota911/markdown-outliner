import { filters } from './filter.ts';
import type { Messages } from './messages.ts';
import type { Bookmark, BookmarkZoom, StatusFilter } from './types.ts';

// `defaultLabel` is the label derived from the view, shown while renaming; empty for an unreadable bookmark.
export interface BookmarkView { bookmark: unknown; label: string; title: string; defaultLabel: string }

export function validBookmark(bookmark: unknown): bookmark is Bookmark {
  const value = bookmark as Bookmark | null;
  const zoom = value?.zoom;
  return !!value && typeof value.id === 'string' && ['file', 'search', 'view'].includes(value.kind)
    && typeof value.file === 'string' && value.file.length > 0
    && filters.includes(value.status)
    && Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string')
    && (value.searchText === undefined || typeof value.searchText === 'string')
    && (zoom === undefined || !!zoom && typeof zoom.path === 'string' && Number.isInteger(zoom.line) && typeof zoom.title === 'string')
    && (value.oneLineNotes === undefined || typeof value.oneLineNotes === 'boolean')
    && (value.name === undefined || typeof value.name === 'string');
}

// What a bookmark restores. A 'file' bookmark of 0.1.x shows the file without filters.
export interface SavedView { file: string; status: StatusFilter; tags: string[]; searchText: string; zoom: BookmarkZoom | null; oneLineNotes: boolean }

export const savedView = (bookmark: Bookmark): SavedView => bookmark.kind === 'file'
  ? { file: bookmark.file, status: 'all', tags: [], searchText: '', zoom: null, oneLineNotes: false }
  : { file: bookmark.file, status: bookmark.status, tags: bookmark.tags, searchText: bookmark.searchText || '', zoom: bookmark.zoom ?? null, oneLineNotes: bookmark.oneLineNotes === true };

// The zoomed item is compared by title, the same way Controller.openBookmark() finds it again.
export const sameView = (a: SavedView, b: SavedView) => a.file === b.file && a.status === b.status
  && JSON.stringify(a.tags) === JSON.stringify(b.tags) && a.searchText === b.searchText && a.oneLineNotes === b.oneLineNotes
  && (a.zoom === null ? b.zoom === null : b.zoom !== null && a.zoom.path === b.zoom.path && a.zoom.title === b.zoom.title);

// The sidebar entry of a stored bookmark, which may be unreadable since storage is user-editable.
export function bookmarkView(bookmark: unknown, t: Messages): BookmarkView {
  if (!validBookmark(bookmark)) return { bookmark, label: t.bookmarks.unreadableLabel, title: t.bookmarks.unreadableLabel, defaultLabel: '' };
  const view = savedView(bookmark);
  const filename = view.file.split('/').pop()!;
  const filtered = view.status !== 'all' || view.tags.length > 0 || view.searchText !== '';
  const base = filtered || bookmark.kind === 'search'
    ? t.bookmarks.searchLabel(t.filter[view.status], view.tags.map(tag => '#' + tag).join(' '), view.searchText, filename)
    : filename;
  const zoomed = view.zoom ? t.bookmarks.zoomLabel(base, view.zoom.title) : base;
  const defaultLabel = view.oneLineNotes ? t.bookmarks.oneLineNotesLabel(zoomed) : zoomed;
  return { bookmark, label: bookmark.name ?? defaultLabel, title: view.file, defaultLabel };
}

// Moves the entry at `from` so that it ends up at index `to`; the other entries keep their order.
export function moveEntry(list: unknown[], from: number, to: number) {
  list.splice(to, 0, ...list.splice(from, 1));
}
