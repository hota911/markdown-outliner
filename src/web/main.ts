import '../styles.css';
import './theme.css';
import './web.css';
import { languageOf, messages, serverErrorText } from '../ui/messages.ts';
import { isMarkdownLink, linkCandidates, openMarkdownLink } from '../ui/links.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Adapter, FileLink, Mounted, Preferences } from '../ui/types.ts';

// Written into the page by server.mjs (see injectConfig).
interface WebConfig {
  token: string;
  // Set only when the server was started on a single file.
  initialFile?: string;
  canCreate: boolean;
  preferencesKey: string;
}

const app = document.getElementById('app')!;
const config = JSON.parse(document.getElementById('outliner-config')!.textContent) as WebConfig;
const language = languageOf(navigator.language);
const t = messages[language];
document.documentElement.lang = language;
document.title = t.web.title;

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  const result = (await response.json()) as T & { code?: unknown };
  if (!response.ok) throw new Error(serverErrorText(t, result.code));
  return result;
}

const fileUrl = (file: string) => '/api/file?path=' + encodeURIComponent(file);
const writeHeaders = { 'Content-Type': 'application/json', 'X-Outliner-Token': config.token };

const adapter: Adapter = {
  list: () => request('/api/files'),
  read: file => request(fileUrl(file)),
  save: (file, text, revision) =>
    request(fileUrl(file), { method: 'PUT', headers: writeHeaders, body: JSON.stringify({ text, revision }) }),
};
if (config.canCreate) {
  adapter.create = (file, text) =>
    request(fileUrl(file), { method: 'POST', headers: writeHeaders, body: JSON.stringify({ text }) });
  adapter.rename = async (from, to) => {
    await request('/api/rename', { method: 'POST', headers: writeHeaders, body: JSON.stringify({ from, to }) });
  };
  adapter.trash = async file => {
    await request('/api/trash', { method: 'POST', headers: writeHeaders, body: JSON.stringify({ path: file }) });
  };
}

let preferences: Preferences = { bookmarks: [] };
try {
  const saved = localStorage.getItem(config.preferencesKey);
  if (saved) preferences = JSON.parse(saved) as Preferences;
} catch (error) {
  app.textContent = t.web.preferencesUnreadable;
  throw error;
}

// Markdown files open in the outliner. Other files open in a new tab from the server, which serves
// the first of the candidate paths that exists; it serves them only for a folder (canCreate).
// The tab is opened before anything is awaited, so that the browser does not block it.
function openLink(link: FileLink) {
  if (isMarkdownLink(link)) return openMarkdownLink(link, adapter, mounted, t);
  if (!config.canCreate) return Promise.reject(new Error(t.link.otherFile));
  const query = linkCandidates(link).map(file => 'path=' + encodeURIComponent(file)).join('&');
  window.open('/api/raw?' + query, '_blank', 'noopener');
  return Promise.resolve();
}

const mounted: Mounted = mountOutliner(app, {
  adapter,
  initialFile: config.initialFile,
  language,
  preferences,
  openLink,
  savePreferences: value => {
    localStorage.setItem(config.preferencesKey, JSON.stringify(value));
    return Promise.resolve();
  },
});
