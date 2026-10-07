<script lang="ts">
  import Bookmarks from './Bookmarks.svelte';
  import Outline from './Outline.svelte';
  import { filters, statuses, syncValue, type Controller } from './controller.svelte.ts';
  import type { StatusFilter } from './types.ts';

  let { ctrl }: { ctrl: Controller } = $props();

  const view = $derived(ctrl.view());
  const starLabel = $derived(ctrl.searchSaved ? ctrl.t.toolbar.removeSearchBookmark : ctrl.t.toolbar.bookmarkSearch);

  function searchKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
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
        <select class="file-select" aria-label={ctrl.t.toolbar.fileSelect} value={view.current} onchange={event => ctrl.openFile(event.currentTarget.value)}>
          {#each view.fileList as path (path)}
            <option value={path}>{path}</option>
          {/each}
        </select>
        <select aria-label={ctrl.t.toolbar.filter} value={view.filter} onchange={event => ctrl.setFilter(event.currentTarget.value as StatusFilter)}>
          {#each filters as value (value)}
            <option {value}>{ctrl.t.filter[value]}</option>
          {/each}
        </select>
        <div class="search-box">
          <input
            class="title-search"
            type="search"
            {@attach syncValue(() => view.searchValue)}
            placeholder={ctrl.t.toolbar.searchPlaceholder}
            aria-label={ctrl.t.toolbar.search}
            oninput={event => ctrl.searchInput(event.currentTarget.value)}
            onkeydown={searchKeydown}
          />
          <button type="button" class="search-star" title={starLabel} aria-label={starLabel} aria-pressed={ctrl.searchSaved} onclick={ctrl.toggleSearchBookmark}>{ctrl.searchSaved ? '★' : '☆'}</button>
        </div>
        {#if view.canOpenSource}
          <button type="button" title={ctrl.t.toolbar.openSourceTitle} onclick={ctrl.openSource}>{ctrl.t.toolbar.openSource}</button>
        {/if}
        <button type="button" title={ctrl.t.toolbar.resetTitle} onclick={ctrl.reset}>{ctrl.t.toolbar.reset}</button>
        <button type="button" title={ctrl.t.toolbar.saveTitle} onclick={() => ctrl.saveAll()}>{ctrl.t.toolbar.save}</button>
        <button type="button" title={ctrl.t.toolbar.reloadTitle} onclick={ctrl.reload}>{ctrl.t.toolbar.reload}</button>
        <button type="button" title={ctrl.t.toolbar.undoTitle} onclick={() => ctrl.history(true)}>{ctrl.t.toolbar.undo}</button>
        <button type="button" title={ctrl.t.toolbar.redoTitle} onclick={() => ctrl.history(false)}>{ctrl.t.toolbar.redo}</button>
        <label class="auto-save"><input type="checkbox" checked={view.autoSave} aria-label={ctrl.t.toolbar.autoSave} onchange={event => ctrl.setAutoSave(event.currentTarget.checked)} />{ctrl.t.toolbar.autoSave}</label>
        {#if view.selectionCount}
          <div class="selection-bar">
            <span>{ctrl.t.toolbar.selected(view.selectionCount)}</span>
            <button type="button" title={ctrl.t.toolbar.moveSelectionUp} onclick={() => ctrl.moveSelection(false)}>↑</button>
            <button type="button" title={ctrl.t.toolbar.moveSelectionDown} onclick={() => ctrl.moveSelection(true)}>↓</button>
            {#each statuses as status (status)}
              <button type="button" title={ctrl.t.selectionStatus(status)} onclick={() => ctrl.setSelectionStatus(status)}>{ctrl.t.status[status]}</button>
            {/each}
            <button type="button" title={ctrl.t.toolbar.clearSelectionTitle} onclick={ctrl.clearSelectionAndRender}>{ctrl.t.toolbar.clearSelection}</button>
          </div>
        {/if}
      </div>
    </header>
    {#if view.zoomPath !== null}
      <div class="zoom-bar">
        <button type="button" class="quiet" title={ctrl.t.toolbar.zoomOutTitle} onclick={ctrl.zoomOut}>{ctrl.t.toolbar.zoomOut}</button>
        <span>{view.zoomPath}</span>
      </div>
    {/if}
    <div class="alerts" aria-live="polite">
      {#if ctrl.notice}
        <div class="notice">{ctrl.notice}</div>
      {/if}
      {#each view.conflicts as conflict (conflict.path)}
        <div class="conflict">
          {#if conflict.hunks}
            <p>{ctrl.t.conflict.conflictingLines(conflict.path, conflict.hunks.length)}</p>
            {#each conflict.hunks as hunk, index (index)}
              <div class="conflict-hunk">
                <div><span>{ctrl.t.conflict.yours}</span><pre>{hunk.ours ?? ctrl.t.conflict.removed}</pre></div>
                <div><span>{ctrl.t.conflict.external}</span><pre>{hunk.theirs ?? ctrl.t.conflict.removed}</pre></div>
              </div>
            {/each}
            <button type="button" title={ctrl.t.conflict.keepMineTitle} onclick={() => ctrl.resolveConflict(conflict.path, 'ours')}>{ctrl.t.conflict.keepMine}</button>
            <button type="button" title={ctrl.t.conflict.takeExternalTitle} onclick={() => ctrl.resolveConflict(conflict.path, 'theirs')}>{ctrl.t.conflict.takeExternal}</button>
          {:else}
            <p>{ctrl.t.conflict.message(conflict.path)}</p>
          {/if}
          <textarea class="local-copy" readonly value={conflict.text} aria-label={ctrl.t.conflict.copyLabel(conflict.path)}></textarea>
          <button type="button" title={ctrl.t.conflict.copyTitle} onclick={event => copyConflict(conflict.path, event)}>{ctrl.t.conflict.copy}</button>
          <button type="button" title={ctrl.t.conflict.openExternalTitle} onclick={() => ctrl.openExternal(conflict.path)}>{ctrl.t.conflict.openExternal}</button>
        </div>
      {/each}
    </div>
    <main class="outline">
      {#if view.outline}
        <Outline {ctrl} outline={view.outline} />
      {:else}
        <div class="empty">{ctrl.t.opening}</div>
      {/if}
    </main>
    <footer class="help">{ctrl.t.help}</footer>
  </div>
</div>
{#if ctrl.toast}
  <div class="toast">
    <span role="status">{ctrl.toast}</span>
    <button type="button" class="icon" title={ctrl.t.closeToast} onclick={ctrl.clearToast}>×</button>
  </div>
{/if}
