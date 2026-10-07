import { serverErrorText, type Messages } from '../ui/messages.ts';
import type { Adapter, Revision } from '../ui/types.ts';

// The commands in src-tauri/src/lib.rs. A rejected command carries an error code from `server` in
// src/ui/messages.ts, the same codes server.mjs sends to the web version.
export type TauriCommands = {
  list: [Record<string, never>, string[]];
  read: [{ path: string }, { text: string; revision: Revision }];
  save: [{ path: string; text: string; revision: Revision }, { revision: Revision }];
  create: [{ path: string; text: string }, { revision: Revision }];
  load_preferences: [Record<string, never>, string | null];
  save_preferences: [{ value: string }, null];
};

// `invoke` from @tauri-apps/api/core.
export type Invoke = (command: keyof TauriCommands, args: Record<string, unknown>) => Promise<unknown>;

export function createTauriApi(invoke: Invoke, t: Messages) {
  async function call<C extends keyof TauriCommands>(command: C, args: TauriCommands[C][0]): Promise<TauriCommands[C][1]> {
    try { return (await invoke(command, args)) as TauriCommands[C][1]; }
    catch (error) { throw new Error(serverErrorText(t, error)); }
  }
  const adapter: Adapter = {
    list: () => call('list', {}),
    read: path => call('read', { path }),
    save: (path, text, revision) => call('save', { path, text, revision }),
    create: (path, text) => call('create', { path, text }),
  };
  return {
    adapter,
    // Bookmarks are stored per folder by the app, as the JSON the web version keeps in local storage.
    loadPreferences: () => call('load_preferences', {}),
    savePreferences: (value: string) => call('save_preferences', { value }).then(() => undefined),
  };
}
