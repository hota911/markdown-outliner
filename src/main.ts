import { ItemView, Notice, Plugin, Scope, normalizePath, type TFile, type WorkspaceLeaf } from 'obsidian';
import { mountOutliner } from './ui/mount.ts';
import type { Doc, Mounted, Preferences } from './ui/types.ts';

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
  getDisplayText() { return 'Markdown アウトライナー'; }
  getIcon() { return 'list-tree'; }

  async onOpen() {
    this.mounted?.destroy();
    const vault = this.app.vault;
    // Paths are relative to the vault root; the UI resolves embeds against the embedding file's folder.
    const vaultPath = (relative: string) => {
      if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.startsWith('/') || relative.includes('\\') || relative.split('/').includes('..')) {
        throw new Error('Vault 内の Markdown を Vault からの相対パスで指定してください。');
      }
      return normalizePath(relative);
    };
    const resolve = (relative: string): TFile => {
      const file = vault.getFileByPath(vaultPath(relative));
      if (!file || file.extension !== 'md') throw new Error('参照先の Markdown がありません。');
      return file;
    };
    this.contentEl.empty();
    this.contentEl.addClass('markdown-outliner-container');
    this.mounted = mountOutliner(this.contentEl, {
      drafts: this.plugin.drafts,
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
            new Notice('通常エディタには保存済みの内容を開きます。アウトライナーの入力は未保存です。');
          }
          await this.app.workspace.getLeaf('tab').openFile(file);
        },
        save: async (relative, text, revision) => {
          const file = resolve(relative);
          await vault.process(file, current => {
            if (current !== revision) throw new Error('外部で変更されています。入力をコピーしてから読み直してください。');
            return text;
          });
          return { revision: text };
        },
        create: async (relative, text) => {
          const path = vaultPath(relative);
          if (vault.getFileByPath(path) || vault.getFolderByPath(path)) throw new Error('同じ名前のファイルがすでにあります。');
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
      new Notice('未保存の入力を保持しています。アウトライナーを開き直して保存してください。Obsidian の終了前に保存が必要です。');
    }
  }
}

export default class MarkdownOutlinerPlugin extends Plugin {
  drafts = new Map<string, Doc>();
  preferences: Preferences = { bookmarks: [] };

  async onload() {
    this.drafts = new Map();
    this.preferences = (await this.loadData() as Preferences | null) || { bookmarks: [] };
    this.registerView(VIEW_TYPE, leaf => new OutlinerView(leaf, this));
    // No default hotkey; users can assign one in Settings > Hotkeys.
    this.addCommand({ id: 'open-outliner', name: 'アウトライナーを開く', callback: () => this.openView() });
    this.addRibbonIcon('list-tree', 'アウトライナーを開く', () => this.openView());
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
