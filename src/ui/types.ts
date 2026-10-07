import type { Status } from '../core.ts';

// Web uses content hashes, Obsidian uses the text itself, tests use counters.
export type Revision = string | number;

export interface Adapter {
  list(): Promise<string[]>;
  read(path: string): Promise<{ text: string; revision: Revision }>;
  save(path: string, text: string, revision: Revision): Promise<{ revision: Revision }>;
  // Missing when the web app was opened on a single file.
  create?(path: string, text: string): Promise<{ revision: Revision }>;
  openSource?(path: string): Promise<void>;
}

export interface Doc {
  text: string;
  baseRevision: Revision;
  dirty: boolean;
  conflict: boolean;
}

export type StatusFilter = 'all' | 'not-done' | Status;

export interface Bookmark {
  id: string;
  kind: 'file' | 'search';
  file: string;
  status: StatusFilter;
  tags: string[];
  searchText?: string;
}

// Loaded from user-editable storage, so bookmarks are validated before use.
export interface Preferences {
  bookmarks: unknown[];
  sidebarCollapsed?: boolean;
}

export interface MountOptions {
  adapter: Adapter;
  // Obsidian keeps drafts on the plugin so unsaved input survives closing the view.
  drafts?: Map<string, Doc>;
  initialFile?: string;
  preferences?: Preferences;
  savePreferences?: (value: Preferences) => Promise<void>;
}

export interface Mounted {
  completeActive(): boolean;
  destroy(): void;
}
