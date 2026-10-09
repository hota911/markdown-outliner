import '../styles.css';
import '../web/theme.css';
import '../web/web.css';
import { languageOf, messages } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import { createMemoryAdapter } from './adapter.ts';

// The files of samples/, embedded at build time and keyed by their path inside samples/.
const samples = import.meta.glob<string>('../../samples/**/*.md', { query: '?raw', import: 'default', eager: true });
const seed = Object.fromEntries(Object.entries(samples).map(([path, text]) => [path.replace('../../samples/', ''), text]));

const language = languageOf(navigator.language);
const t = messages[language];
document.documentElement.lang = language;
document.title = t.web.title;

// Nothing is persisted: a reload starts again from the samples.
mountOutliner(document.getElementById('app')!, { adapter: createMemoryAdapter(seed, t), language });
