<script lang="ts">
  import type { Controller, View } from './controller.svelte.ts';
  import { fadeIn } from './motion.ts';

  let { ctrl, view }: { ctrl: Controller; view: View } = $props();

  const toggleLabel = $derived(view.sidebarCollapsed ? ctrl.t.bookmarks.expand : ctrl.t.bookmarks.collapse);
</script>

<aside class="bookmarks" class:is-collapsed={view.sidebarCollapsed} aria-label={ctrl.t.bookmarks.heading}>
  <div class="bookmarks-header">
    {#if !view.sidebarCollapsed}
      <h2 class="bookmarks-heading" in:fadeIn>{ctrl.t.bookmarks.heading}</h2>
    {/if}
    <button type="button" class="icon sidebar-toggle" title={toggleLabel} aria-label={toggleLabel} aria-expanded={!view.sidebarCollapsed} onclick={ctrl.toggleSidebar}>{view.sidebarCollapsed ? '›' : '‹'}</button>
  </div>
  <!-- The content fades in while the panel widens (styles.css). The nested blocks need |global to
       play when the outer block opens; the initial mount plays no intros. -->
  {#if !view.sidebarCollapsed}
    <div class="bookmark-actions" in:fadeIn>
      <button type="button" title={ctrl.t.bookmarks.addFileTitle} onclick={() => ctrl.addBookmark('file')}>{ctrl.t.bookmarks.addFile}</button>
    </div>
    {#if !view.bookmarksValid}
      <p class="bookmark-empty" in:fadeIn|global>{ctrl.t.bookmarks.settingsUnreadable}</p>
    {:else}
      <ul class="bookmark-list" in:fadeIn|global>
        {#each view.bookmarks as entry, index (index)}
          <li class="bookmark-item">
            <button type="button" class="bookmark-open" title={entry.title} onclick={() => ctrl.openBookmark(entry.bookmark)}>{entry.label}</button>
            <button type="button" class="icon" title={ctrl.t.bookmarks.remove(entry.label)} aria-label={ctrl.t.bookmarks.remove(entry.label)} onclick={() => ctrl.removeBookmark(entry.bookmark)}>×</button>
          </li>
        {/each}
      </ul>
      {#if !view.bookmarks.length}
        <p class="bookmark-empty" in:fadeIn|global>{ctrl.t.bookmarks.empty}</p>
      {/if}
    {/if}
  {/if}
</aside>
