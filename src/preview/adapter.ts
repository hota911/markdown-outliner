import { usableBaseName } from '../core.ts';
import { serverErrorText, type Messages, type ServerErrorCode } from '../ui/messages.ts';
import type { Adapter } from '../ui/types.ts';

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/**
 * An adapter that keeps the files in memory, for the static preview build. It fails with the same
 * error codes as server.mjs where the page depends on them: a save with a stale revision, a create
 * or rename onto an existing file, and an invalid new name.
 */
export function createMemoryAdapter(seed: Record<string, string>, t: Messages): Adapter {
  const files = new Map(Object.entries(seed));
  // One counter for all files, so a revision is never reused, even after a rename.
  let lastRevision = 0;
  const revisions = new Map([...files.keys()].map(path => [path, String(++lastRevision)]));
  const fail = (code: ServerErrorCode) => new Error(serverErrorText(t, code));
  // Runs `operation` and turns what it throws into a rejection, as a request to the server would.
  const settle = <T>(operation: () => T) => new Promise<T>(resolve => resolve(operation()));

  function existing(path: string) {
    if (!path.endsWith('.md')) throw fail('notMarkdown');
    const text = files.get(path);
    if (text === undefined) throw fail('fileMissing');
    return text;
  }

  function write(path: string, text: string) {
    files.set(path, text);
    const revision = String(++lastRevision);
    revisions.set(path, revision);
    return { revision };
  }

  return {
    list: () => settle(() => [...files.keys()].sort()),
    read: path => settle(() => ({ text: existing(path), revision: revisions.get(path)! })),
    save: (path, text, revision) => settle(() => {
      existing(path);
      if (revisions.get(path) !== revision) throw fail('externalChange');
      return write(path, text);
    }),
    create: (path, text) => settle(() => {
      if (!path.endsWith('.md')) throw fail('notMarkdown');
      if (files.has(path)) throw fail('fileExists');
      const folder = parentOf(path);
      if (folder !== '' && ![...files.keys()].some(file => file.startsWith(folder + '/'))) throw fail('folderMissing');
      return write(path, text);
    }),
    rename: (path, newPath) => settle(() => {
      const text = existing(path);
      if (!newPath.endsWith('.md')) throw fail('notMarkdown');
      if (parentOf(newPath) !== parentOf(path)) throw fail('renameOtherFolder');
      if (!usableBaseName(newPath.split('/').pop()!.slice(0, -'.md'.length))) throw fail('invalidName');
      if (files.has(newPath)) throw fail('fileExists');
      files.delete(path);
      files.set(newPath, text);
      revisions.set(newPath, revisions.get(path)!);
      revisions.delete(path);
    }),
  };
}
