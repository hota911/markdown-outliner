import type { Status } from '../core.ts';
import type { Conflict } from '../three-way-merge.ts';
import type { Language } from './messages.ts';

// Web uses content hashes, Obsidian uses the text itself, tests use counters.
export type Revision = string | number;

export interface Adapter {
  list(): Promise<string[]>;
  read(path: string): Promise<{ text: string; revision: Revision }>;
  save(path: string, text: string, revision: Revision): Promise<{ revision: Revision }>;
  // Missing when the web app was opened on a single file.
  create?(path: string, text: string): Promise<{ revision: Revision }>;
  // Renames a file within its folder and fails if `newPath` exists. Obsidian also updates links
  // in other files, as the user's settings say; the web server leaves them as they are.
  // Missing when the web app was opened on a single file.
  rename?(path: string, newPath: string): Promise<void>;
  openSource?(path: string): Promise<void>;
  // Tags in use across the host's files, without `#`, for the `#` menu. Obsidian has them from its
  // metadata cache; without this method the menu offers the tags of the files the outliner has read.
  tags?(): Promise<string[]>;
}

export interface Doc {
  text: string;
  // The text as last loaded or saved: the common base when merging an external change.
  baseText: string;
  baseRevision: Revision;
  dirty: boolean;
  conflict: boolean;
  // The external version whose changes to the same lines conflict with this text, while unresolved.
  external?: { text: string; revision: Revision; conflicts: Conflict[] };
}

export type StatusFilter = 'all' | 'not-done' | Status;

// The zoomed item, found again by its title: line numbers shift when the file is edited elsewhere.
// `line` only picks the nearest item when several have the same title.
export interface BookmarkZoom {
  path: string;
  line: number;
  title: string;
}

// New bookmarks are 'view'. 'file' (file only, filters reset) and 'search' were written by 0.1.x
// and are still read as they are.
export interface Bookmark {
  id: string;
  kind: 'file' | 'search' | 'view';
  file: string;
  status: StatusFilter;
  tags: string[];
  searchText?: string;
  zoom?: BookmarkZoom;
  // Set when the user renamed the bookmark; otherwise the label is derived from the view.
  name?: string;
}

// Loaded from user-editable storage, so bookmarks are validated before use.
export interface Preferences {
  bookmarks: unknown[];
  sidebarCollapsed?: boolean;
  // The file shown last; reopened on the next start while it is still in the file list.
  lastFile?: string;
}

export interface MountOptions {
  adapter: Adapter;
  // Obsidian keeps drafts on the plugin so unsaved input survives closing the view.
  drafts?: Map<string, Doc>;
  // The file to show first. Without it, the last file shown or else the first listed file opens.
  initialFile?: string;
  // Display language, chosen by the host: Obsidian's language or the browser's.
  language: Language;
  preferences?: Preferences;
  savePreferences?: (value: Preferences) => Promise<void>;
}

export interface Mounted {
  completeActive(): boolean;
  destroy(): void;
}
