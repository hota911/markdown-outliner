import '../styles.css';
import './theme.css';
import './web.css';
import { languageOf, messages, serverErrorText } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Adapter, Preferences } from '../ui/types.ts';

// Written into the page by server.mjs (see injectConfig).
interface WebConfig {
  token: string;
  initialFile: string;
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
}

let preferences: Preferences = { bookmarks: [] };
try {
  const saved = localStorage.getItem(config.preferencesKey);
  if (saved) preferences = JSON.parse(saved) as Preferences;
} catch (error) {
  app.textContent = t.web.preferencesUnreadable;
  throw error;
}

mountOutliner(app, {
  adapter,
  initialFile: config.initialFile,
  language,
  preferences,
  savePreferences: value => {
    localStorage.setItem(config.preferencesKey, JSON.stringify(value));
    return Promise.resolve();
  },
});
