import { FileView, ItemView, MarkdownView, Notice, Plugin, Scope, TFile, getLanguage, normalizePath, requireApiVersion, type Menu, type WorkspaceLeaf } from 'obsidian';
import { languageOf, messages, type Language, type Messages } from '../ui/messages.ts';
import { mountOutliner } from '../ui/mount.ts';
import type { Doc, Mounted, Preferences } from '../ui/types.ts';

const VIEW_TYPE = 'markdown-outliner';
// Experimental: one Markdown file per tab, restored from the view state like a regular editor tab.
const FILE_VIEW_TYPE = 'markdown-outliner-file';

// Mod+Enter would otherwise run Obsidian's own hotkey, so the view's scope hands it to the outliner.
function bindCompleteShortcut(view: ItemView, mounted: () => Mounted | null) {
  view.scope = new Scope(view.app.scope);
  view.scope.register(['Mod'], 'Enter', event => {
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
    if (event.isComposing || event.keyCode === 229) return;
    if (mounted()?.completeActive()) { event.preventDefault(); return false; }
  });
}

// Mounts the outliner into the view with an adapter over the whole vault, so embeds in any
// folder can be read and saved. `initialFile` is the file shown first.
function mountInView(view: ItemView, plugin: MarkdownOutlinerPlugin, drafts: Map<string, Doc>, initialFile?: string): Mounted {
  const vault = view.app.vault;
  const t = plugin.t.obsidian;
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
  view.contentEl.empty();
  view.contentEl.addClass('markdown-outliner-container');
  return mountOutliner(view.contentEl, {
    drafts,
    initialFile,
    language: plugin.language,
    preferences: plugin.preferences,
    savePreferences: value => plugin.saveData(value),
    adapter: {
      list: async () => vault.getMarkdownFiles().map(file => file.path).sort(),
      read: async relative => {
        const text = await vault.read(resolve(relative));
        return { text, revision: text };
      },
      openSource: async relative => {
        const file = resolve(relative);
        if (drafts.get(relative)?.dirty) {
          new Notice(t.openSourceUnsaved);
        }
        await view.app.workspace.getLeaf('tab').openFile(file);
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

const hasUnsaved = (drafts: Map<string, Doc>) => [...drafts.values()].some(doc => doc.dirty);

class OutlinerView extends ItemView {
  private mounted: Mounted | null = null;
  private readonly plugin: MarkdownOutlinerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MarkdownOutlinerPlugin) {
    super(leaf);
    this.plugin = plugin;
    bindCompleteShortcut(this, () => this.mounted);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.plugin.t.obsidian.viewTitle; }
  getIcon() { return 'list-tree'; }

  async onOpen() {
    this.mounted?.destroy();
    this.mounted = mountInView(this, this.plugin, this.plugin.drafts);
  }

  async onClose() {
    if (!this.mounted) return;
    // Unmounts the Svelte component and stops its timers and listeners.
    this.mounted.destroy();
    this.mounted = null;
    if (hasUnsaved(this.plugin.drafts)) {
      new Notice(this.plugin.t.obsidian.closedWithUnsaved);
    }
  }
}

// A tab bound to one Markdown file. The file path is in the view state, so the tab title,
// navigation history and workspace restore work as they do for the regular editor.
class OutlinerFileView extends FileView {
  private mounted: Mounted | null = null;
  // The drafts of this tab and of the files it embeds; not shared with other open views, so two
  // views of one file detect each other's saves as external changes.
  private drafts = new Map<string, Doc>();
  private readonly plugin: MarkdownOutlinerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: MarkdownOutlinerPlugin) {
    super(leaf);
    this.plugin = plugin;
    bindCompleteShortcut(this, () => this.mounted);
  }

  getViewType() { return FILE_VIEW_TYPE; }
  getIcon() { return 'list-tree'; }
  canAcceptExtension(extension: string) { return extension === 'md'; }

  async onLoadFile(file: TFile) {
    this.drafts = this.plugin.takeFileDrafts(file.path);
    this.mount(file);
  }

  async onUnloadFile(file: TFile) {
    this.unmount(file.path);
  }

  // The outliner was mounted on the old path. Drafts stay keyed by the old path, so unsaved input
  // there fails to save as a conflict instead of disappearing.
  async onRename(file: TFile) {
    this.mount(file);
  }

  async onClose() {
    await super.onClose();
    if (this.file) this.unmount(this.file.path);
  }

  onPaneMenu(menu: Menu, source: string) {
    super.onPaneMenu(menu, source);
    const file = this.file;
    if (!file) return;
    menu.addItem(item => item
      .setTitle(this.plugin.t.obsidian.openAsMarkdown)
      .setIcon('file-text')
      .onClick(() => this.leaf.setViewState({ type: 'markdown', state: { file: file.path }, active: true })));
  }

  private mount(file: TFile) {
    this.mounted?.destroy();
    this.mounted = mountInView(this, this.plugin, this.drafts, file.path);
  }

  // Unsaved drafts are kept on the plugin under `path` until the file is opened as an outline again.
  private unmount(path: string) {
    if (!this.mounted) return;
    this.mounted.destroy();
    this.mounted = null;
    if (hasUnsaved(this.drafts)) {
      this.plugin.fileDrafts.set(path, this.drafts);
      new Notice(this.plugin.t.obsidian.closedWithUnsaved);
    }
  }
}

export default class MarkdownOutlinerPlugin extends Plugin {
  drafts = new Map<string, Doc>();
  // Unsaved drafts of closed file tabs, by the path the tab was bound to.
  fileDrafts = new Map<string, Map<string, Doc>>();
  preferences: Preferences = { bookmarks: [] };
  language: Language = 'en';
  t: Messages = messages.en;

  async onload() {
    // getLanguage() is newer than minAppVersion; older Obsidian falls back to English, the default.
    this.language = languageOf(requireApiVersion('1.8.7') ? getLanguage() : 'en');
    this.t = messages[this.language];
    this.drafts = new Map();
    this.fileDrafts = new Map();
    this.preferences = (await this.loadData() as Preferences | null) || { bookmarks: [] };
    const t = this.t.obsidian;
    this.registerView(VIEW_TYPE, leaf => new OutlinerView(leaf, this));
    this.registerView(FILE_VIEW_TYPE, leaf => new OutlinerFileView(leaf, this));
    // No default hotkeys; users can assign them in Settings > Hotkeys.
    this.addCommand({ id: 'open-outliner', name: t.openOutliner, callback: () => this.openView() });
    this.addCommand({
      id: 'open-file-as-outline',
      name: t.openAsOutline,
      checkCallback: checking => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) void this.openAsOutline(view.file, view.leaf);
        return true;
      },
    });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return;
      menu.addItem(item => item
        .setTitle(t.openAsOutline)
        .setIcon('list-tree')
        .onClick(() => this.openAsOutline(file, leaf ?? this.app.workspace.getLeaf('tab'))));
    }));
    this.addRibbonIcon('list-tree', t.openOutliner, () => this.openView());
  }

  // Hands the kept drafts of `path` to the tab that opens it, so only one open tab edits them.
  takeFileDrafts(path: string) {
    const drafts = this.fileDrafts.get(path) ?? new Map<string, Doc>();
    this.fileDrafts.delete(path);
    return drafts;
  }

  // No onunload: Obsidian closes views of a registered type itself, so leaves are not detached here.
  async openView() {
    try {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] || this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice((error as Error).message); }
  }

  async openAsOutline(file: TFile, leaf: WorkspaceLeaf) {
    try {
      await leaf.setViewState({ type: FILE_VIEW_TYPE, state: { file: file.path }, active: true });
    } catch (error) { new Notice((error as Error).message); }
  }
}
