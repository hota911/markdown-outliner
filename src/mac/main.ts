import '../styles.css';
import '../web/theme.css';
import '../web/web.css';
import { languageOf, messages } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Preferences } from '../ui/types.ts';
import { createMacApi, type Post } from './adapter.ts';

declare global {
  interface Window {
    webkit: { messageHandlers: { outliner: { postMessage: Post } } };
  }
}

const app = document.getElementById('app')!;
const language = languageOf(navigator.language);
const t = messages[language];
document.documentElement.lang = language;
const api = createMacApi(request => window.webkit.messageHandlers.outliner.postMessage(request), t);

void api.loadPreferences().then(saved => {
  mountOutliner(app, {
    adapter: api.adapter,
    initialFile: 'tasks.md',
    language,
    preferences: saved ? JSON.parse(saved) as Preferences : { bookmarks: [] },
    savePreferences: value => api.savePreferences(JSON.stringify(value)),
  });
});
