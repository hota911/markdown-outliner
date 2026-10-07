<script lang="ts">
  import Bookmarks from './Bookmarks.svelte';
  import Outline from './Outline.svelte';
  import { filters, statuses, syncValue, type Controller } from './controller.svelte.ts';
  import type { StatusFilter } from './types.ts';

  let { ctrl }: { ctrl: Controller } = $props();

  const view = $derived(ctrl.view());
  const starLabel = $derived(ctrl.searchSaved ? '検索のブックマークを解除' : '検索をブックマーク');

  function searchKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      ctrl.applySearch(event.currentTarget.value);
    }
  }

  function copyConflict(path: string, event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    ctrl.copyConflict(path, event.currentTarget.parentElement!.querySelector<HTMLTextAreaElement>('.local-copy')!);
  }
</script>

<div class="outliner-workspace" tabindex="-1">
  <Bookmarks {ctrl} {view} />
  <div class="outliner-editor">
    <header class="app-header">
      <div class="app-name">Markdown Outliner</div>
      <span class="save-state" class:dirty={ctrl.saveState.dirty}>{ctrl.saveState.text}</span>
      <div class="toolbar">
        <select class="file-select" aria-label="開くファイル" value={view.current} onchange={event => ctrl.openFile(event.currentTarget.value)}>
          {#each view.fileList as path (path)}
            <option value={path}>{path}</option>
          {/each}
        </select>
        <select aria-label="表示する状態" value={view.filter} onchange={event => ctrl.setFilter(event.currentTarget.value as StatusFilter)}>
          {#each filters as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
        <div class="search-box">
          <input
            class="title-search"
            type="search"
            {@attach syncValue(() => view.searchValue)}
            placeholder="語句・#タグで絞り込み"
            aria-label="語句・タグで絞り込み"
            oninput={event => ctrl.searchInput(event.currentTarget.value)}
            onkeydown={searchKeydown}
          />
          <button type="button" class="search-star" title={starLabel} aria-label={starLabel} aria-pressed={ctrl.searchSaved} onclick={ctrl.toggleSearchBookmark}>{ctrl.searchSaved ? '★' : '☆'}</button>
        </div>
        {#if view.canOpenSource}
          <button type="button" title="表示中の元ファイルを通常エディタで開く" onclick={ctrl.openSource}>Markdown で開く</button>
        {/if}
        <button type="button" title="検索・タグ・状態の絞り込みをリセット" onclick={ctrl.reset}>リセット</button>
        <button type="button" title="変更したファイルを保存" onclick={() => ctrl.saveAll()}>保存</button>
        <button type="button" title="変更があるファイルは保存するか入力を保持します" onclick={ctrl.reload}>再読込</button>
        <button type="button" title="元に戻す" onclick={() => ctrl.history(true)}>Undo</button>
        <button type="button" title="やり直す" onclick={() => ctrl.history(false)}>Redo</button>
        <label class="auto-save"><input type="checkbox" checked={view.autoSave} aria-label="自動保存" onchange={event => ctrl.setAutoSave(event.currentTarget.checked)} />自動保存</label>
        {#if view.selectionCount}
          <div class="selection-bar">
            <span>{view.selectionCount} 項目を選択</span>
            <button type="button" title="選択した項目をまとめて上へ移動" onclick={() => ctrl.moveSelection(false)}>↑</button>
            <button type="button" title="選択した項目をまとめて下へ移動" onclick={() => ctrl.moveSelection(true)}>↓</button>
            {#each statuses as [status, label] (status)}
              <button type="button" title={'選択したタスクを' + label + 'にする'} onclick={() => ctrl.setSelectionStatus(status)}>{label}</button>
            {/each}
            <button type="button" title="選択した項目を解除" onclick={ctrl.clearSelectionAndRender}>選択解除</button>
          </div>
        {/if}
      </div>
    </header>
    {#if view.zoomPath !== null}
      <div class="zoom-bar">
        <button type="button" class="quiet" title="ズームを解除" onclick={ctrl.zoomOut}>← 全体に戻る</button>
        <span>{view.zoomPath}</span>
      </div>
    {/if}
    <div class="alerts" aria-live="polite">
      {#if ctrl.notice}
        <div class="notice">{ctrl.notice}</div>
      {/if}
      {#each view.conflicts as conflict (conflict.path)}
        <div class="conflict">
          <p>{conflict.path} に外部の変更があります。入力内容を残しています。必要ならコピーしてから外部の内容を開いてください。</p>
          <textarea class="local-copy" readonly value={conflict.text} aria-label={conflict.path + ' の保存前の入力内容'}></textarea>
          <button type="button" title="入力内容を選択してコピー" onclick={event => copyConflict(conflict.path, event)}>入力内容をコピー</button>
          <button type="button" title="入力内容を履歴に残して外部の内容へ切り替える" onclick={() => ctrl.openExternal(conflict.path)}>外部の内容を開く</button>
        </div>
      {/each}
    </div>
    <main class="outline">
      {#if view.outline}
        <Outline {ctrl} outline={view.outline} />
      {:else}
        <div class="empty">ファイルを開いています…</div>
      {/if}
    </main>
    <footer class="help">↑↓: カーソル移動 · Enter: 追加 · ⌘/Ctrl+Enter: 進行中→完了 · Tab / Shift+Tab: 階層 · Shift+Enter: タスク⇄ノート · ⠿: ドラッグ（挿入線の字下げで階層を表示） · Shift / ⌘クリック: 複数選択</footer>
  </div>
</div>
{#if ctrl.toast}
  <div class="toast">
    <span role="status">{ctrl.toast}</span>
    <button type="button" class="icon" title="通知を閉じる" onclick={ctrl.clearToast}>×</button>
  </div>
{/if}
