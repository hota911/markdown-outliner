import '../styles.css';
import '../web/theme.css';
import '../web/web.css';
import { invoke } from '@tauri-apps/api/core';
import { languageOf, messages } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Preferences } from '../ui/types.ts';
import { createTauriApi } from './adapter.ts';

const app = document.getElementById('app')!;
const language = languageOf(navigator.language);
const t = messages[language];
document.documentElement.lang = language;
const api = createTauriApi(invoke, t);

async function start() {
  const saved = await api.loadPreferences();
  let preferences: Preferences = { bookmarks: [] };
  try {
    if (saved) preferences = JSON.parse(saved) as Preferences;
  } catch (error) {
    app.textContent = t.web.preferencesUnreadable;
    throw error;
  }
  mountOutliner(app, {
    adapter: api.adapter,
    initialFile: 'tasks.md',
    language,
    preferences,
    savePreferences: value => api.savePreferences(JSON.stringify(value)),
  });
}

void start();
