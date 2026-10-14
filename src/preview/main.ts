import '../styles.css';
import '../web/theme.css';
import '../web/web.css';
import { languageOf, messages } from '../ui/messages.ts';
import { isMarkdownLink, openMarkdownLink } from '../ui/links.ts';
import { mountOutliner } from '../ui/mount.ts';
import { isSearchShortcut } from '../ui/controller.svelte.ts';
import { createMemoryAdapter } from './adapter.ts';

// The files of samples/, embedded at build time and keyed by their path inside samples/.
const samples = import.meta.glob<string>('../../samples/**/*.md', { query: '?raw', import: 'default', eager: true });
const seed = Object.fromEntries(Object.entries(samples).map(([path, text]) => [path.replace('../../samples/', ''), text]));

const language = languageOf(navigator.language);
const t = messages[language];
document.documentElement.lang = language;
document.title = t.web.title;

// Nothing is persisted: a reload starts again from the samples. Only links to Markdown files can be
// opened, in the outliner.
const adapter = createMemoryAdapter(seed, t);
const mounted = mountOutliner(document.getElementById('app')!, {
  adapter,
  language,
  openLink: link => isMarkdownLink(link) ? openMarkdownLink(link, adapter, mounted, t) : Promise.reject(new Error(t.link.otherFile)),
});

window.addEventListener('keydown', event => {
  if (!event.defaultPrevented && !event.isComposing && isSearchShortcut(event) && mounted.focusSearch()) event.preventDefault();
});
