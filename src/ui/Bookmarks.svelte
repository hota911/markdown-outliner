<script lang="ts">
  import type { Controller, View } from './controller.svelte.ts';

  let { ctrl, view }: { ctrl: Controller; view: View } = $props();

  const toggleLabel = $derived(view.sidebarCollapsed ? ctrl.t.bookmarks.expand : ctrl.t.bookmarks.collapse);
</script>

<aside class="bookmarks" class:is-collapsed={view.sidebarCollapsed} aria-label={ctrl.t.bookmarks.heading}>
  <div class="bookmarks-header">
    {#if !view.sidebarCollapsed}
      <h2 class="bookmarks-heading">{ctrl.t.bookmarks.heading}</h2>
    {/if}
    <button type="button" class="icon sidebar-toggle" title={toggleLabel} aria-label={toggleLabel} aria-expanded={!view.sidebarCollapsed} onclick={ctrl.toggleSidebar}>{view.sidebarCollapsed ? '›' : '‹'}</button>
  </div>
  {#if !view.sidebarCollapsed}
    <div class="bookmark-actions">
      <button type="button" title={ctrl.t.bookmarks.addFileTitle} onclick={() => ctrl.addBookmark('file')}>{ctrl.t.bookmarks.addFile}</button>
    </div>
    {#if !view.bookmarksValid}
      <p class="bookmark-empty">{ctrl.t.bookmarks.settingsUnreadable}</p>
    {:else}
      <ul class="bookmark-list">
        {#each view.bookmarks as entry, index (index)}
          <li class="bookmark-item">
            <button type="button" class="bookmark-open" title={entry.title} onclick={() => ctrl.openBookmark(entry.bookmark)}>{entry.label}</button>
            <button type="button" class="icon" title={ctrl.t.bookmarks.remove(entry.label)} aria-label={ctrl.t.bookmarks.remove(entry.label)} onclick={() => ctrl.removeBookmark(entry.bookmark)}>×</button>
          </li>
        {/each}
      </ul>
      {#if !view.bookmarks.length}
        <p class="bookmark-empty">{ctrl.t.bookmarks.empty}</p>
      {/if}
    {/if}
  {/if}
</aside>
