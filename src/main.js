const { Plugin, ItemView, Notice, normalizePath, Scope } = require('obsidian');
const core = require('./core.js');
const ui = require('./ui.js');

const VIEW_TYPE = 'markdown-outliner';

class OutlinerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scope = new Scope(this.app.scope);
    this.scope.register(['Mod'], 'Enter', event => {
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
    // Paths are relative to the vault root; ui.js resolves embeds against the embedding file's folder.
    const vaultPath = relative => {
      if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.startsWith('/') || relative.includes('\\') || relative.split('/').includes('..')) {
        throw new Error('Vault 内の Markdown を Vault からの相対パスで指定してください。');
      }
      return normalizePath(relative);
    };
    const resolve = relative => {
      const file = vault.getFileByPath(vaultPath(relative));
      if (!file || file.extension !== 'md') throw new Error('参照先の Markdown がありません。');
      return file;
    };
    this.contentEl.empty();
    this.contentEl.addClass('markdown-outliner-container');
    this.mounted = ui.mount(this.contentEl, { core, drafts: this.plugin.drafts,
      preferences: this.plugin.preferences, savePreferences: value => this.plugin.saveData(value), adapter: {
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
      }
    }});
  }
  async onClose() {
    if (!this.mounted) return;
    this.mounted?.destroy();
    this.mounted = null;
    if ([...this.plugin.drafts.values()].some(doc => doc.dirty)) {
      new Notice('未保存の入力を保持しています。アウトライナーを開き直して保存してください。Obsidian の終了前に保存が必要です。');
    }
  }
}

module.exports = class MarkdownOutlinerPlugin extends Plugin {
  async onload() {
    this.drafts = new Map();
    this.preferences = await this.loadData() || { bookmarks: [] };
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
    } catch (error) { new Notice(error.message); }
  }
};
