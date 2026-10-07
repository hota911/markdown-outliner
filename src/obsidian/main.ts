import { ItemView, Notice, Plugin, Scope, getLanguage, normalizePath, requireApiVersion, type TFile, type WorkspaceLeaf } from 'obsidian';
import { languageOf, messages, type Language, type Messages } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Doc, Mounted, Preferences } from '../ui/types.ts';

const VIEW_TYPE = 'markdown-outliner';

class OutlinerView extends ItemView {
  private mounted: Mounted | null = null;
  private readonly plugin: MarkdownOutlinerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MarkdownOutlinerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.scope = new Scope(this.app.scope);
    this.scope.register(['Mod'], 'Enter', event => {
      // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
      if (event.isComposing || event.keyCode === 229) return;
      if (this.mounted?.completeActive()) { event.preventDefault(); return false; }
    });
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.plugin.t.obsidian.viewTitle; }
  getIcon() { return 'list-tree'; }

  async onOpen() {
    this.mounted?.destroy();
    const vault = this.app.vault;
    const t = this.plugin.t.obsidian;
    // Paths are relative to the vault root; the UI resolves embeds against the embedding file's folder.
    const vaultPath = (relative: string) => {
      if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.startsWith('/') || relative.includes('\\') || relative.split('/').includes('..')) {
        throw new Error(t.vaultRelativePath);
      }
      return normalizePath(relative);
    };
    const resolve = (relative: string): TFile => {
      const file = vault.getFileByPath(vaultPath(relative));
      if (!file || file.extension !== 'md') throw new Error(t.fileMissing);
      return file;
    };
    this.contentEl.empty();
    this.contentEl.addClass('markdown-outliner-container');
    this.mounted = mountOutliner(this.contentEl, {
      drafts: this.plugin.drafts,
      language: this.plugin.language,
      preferences: this.plugin.preferences,
      savePreferences: value => this.plugin.saveData(value),
      adapter: {
        list: async () => vault.getMarkdownFiles().map(file => file.path).sort(),
        read: async relative => {
          const text = await vault.read(resolve(relative));
          return { text, revision: text };
        },
        openSource: async relative => {
          const file = resolve(relative);
          if (this.plugin.drafts.get(relative)?.dirty) {
            new Notice(t.openSourceUnsaved);
          }
          await this.app.workspace.getLeaf('tab').openFile(file);
        },
        save: async (relative, text, revision) => {
          const file = resolve(relative);
          await vault.process(file, current => {
            if (current !== revision) throw new Error(t.externalChange);
            return text;
          });
          return { revision: text };
        },
        create: async (relative, text) => {
          const path = vaultPath(relative);
          if (vault.getFileByPath(path) || vault.getFolderByPath(path)) throw new Error(t.fileExists);
          await vault.create(path, text);
          return { revision: text };
        },
      },
    });
  }

  async onClose() {
    if (!this.mounted) return;
    // Unmounts the Svelte component and stops its timers and listeners.
    this.mounted.destroy();
    this.mounted = null;
    if ([...this.plugin.drafts.values()].some(doc => doc.dirty)) {
      new Notice(this.plugin.t.obsidian.closedWithUnsaved);
    }
  }
}

export default class MarkdownOutlinerPlugin extends Plugin {
  drafts = new Map<string, Doc>();
  preferences: Preferences = { bookmarks: [] };
  language: Language = 'en';
  t: Messages = messages.en;

  async onload() {
    // getLanguage() is newer than minAppVersion; older Obsidian falls back to English, the default.
    this.language = languageOf(requireApiVersion('1.8.7') ? getLanguage() : 'en');
    this.t = messages[this.language];
    this.drafts = new Map();
    this.preferences = (await this.loadData() as Preferences | null) || { bookmarks: [] };
    this.registerView(VIEW_TYPE, leaf => new OutlinerView(leaf, this));
    // No default hotkey; users can assign one in Settings > Hotkeys.
    this.addCommand({ id: 'open-outliner', name: this.t.obsidian.openOutliner, callback: () => this.openView() });
    this.addRibbonIcon('list-tree', this.t.obsidian.openOutliner, () => this.openView());
  }

  // No onunload: Obsidian closes views of a registered type itself, so leaves are not detached here.
  async openView() {
    try {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] || this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice((error as Error).message); }
  }
}
