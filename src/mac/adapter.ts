import { serverErrorText, type Messages } from '../ui/messages.ts';
import type { Adapter, Revision } from '../ui/types.ts';

// The messages FileMessageHandler in mac/main.swift answers. A rejected reply carries an error code
// from `server` in src/ui/messages.ts, the same codes server.mjs sends to the web version.
export type MacRequest =
  | { op: 'list' }
  | { op: 'read'; path: string }
  | { op: 'save'; path: string; text: string; revision: Revision }
  | { op: 'create'; path: string; text: string }
  | { op: 'loadPreferences' }
  | { op: 'savePreferences'; value: string };

// window.webkit.messageHandlers.outliner.postMessage, injected by WKWebView.
export type Post = (request: MacRequest) => Promise<unknown>;

export function createMacApi(post: Post, t: Messages) {
  async function call<T>(request: MacRequest): Promise<T> {
    try { return (await post(request)) as T; }
    catch (error) { throw new Error(serverErrorText(t, error instanceof Error ? error.message : undefined)); }
  }
  const adapter: Adapter = {
    list: () => call({ op: 'list' }),
    read: path => call({ op: 'read', path }),
    save: (path, text, revision) => call({ op: 'save', path, text, revision }),
    create: (path, text) => call({ op: 'create', path, text }),
  };
  return {
    adapter,
    // Bookmarks are stored per folder by the app, as the JSON the web version keeps in local storage.
    loadPreferences: () => call<string | null>({ op: 'loadPreferences' }),
    savePreferences: (value: string) => call<null>({ op: 'savePreferences', value }).then(() => undefined),
  };
}
