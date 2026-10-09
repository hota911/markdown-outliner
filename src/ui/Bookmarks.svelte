<script lang="ts">
  import type { BookmarkView } from './bookmarks.ts';
  import type { Controller, View } from './controller.svelte.ts';
  import { fadeIn } from './motion.ts';

  let { ctrl, view }: { ctrl: Controller; view: View } = $props();

  const toggleLabel = $derived(view.sidebarCollapsed ? ctrl.t.bookmarks.expand : ctrl.t.bookmarks.collapse);

  // The bookmark being renamed, and the name typed so far.
  // Raw, so that it holds the stored object itself rather than a proxy, and compares equal to it.
  let renaming = $state.raw<unknown>(null);
  let draft = $state('');

  const startRename = (entry: BookmarkView) => {
    renaming = entry.bookmark;
    draft = entry.label;
  };

  // Enter and leaving the field save; Escape clears `renaming` first, so the blur that follows does not.
  const finishRename = (bookmark: unknown) => {
    if (renaming !== bookmark) return;
    renaming = null;
    ctrl.renameBookmark(bookmark, draft);
  };

  // Keys stay in the field: the outliner's ⌘Z would otherwise undo an outline edit.
  const renameKey = (event: KeyboardEvent, bookmark: unknown) => {
    event.stopPropagation();
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRename(bookmark);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      renaming = null;
    }
  };

  const focusInput = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
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
      <button type="button" title={ctrl.t.bookmarks.addViewTitle} onclick={ctrl.addBookmark}>{ctrl.t.bookmarks.addView}</button>
    </div>
    {#if !view.bookmarksValid}
      <p class="bookmark-empty" in:fadeIn|global>{ctrl.t.bookmarks.settingsUnreadable}</p>
    {:else}
      <ul class="bookmark-list" in:fadeIn|global>
        {#each view.bookmarks as entry, index (index)}
          <li class="bookmark-item">
            {#if renaming === entry.bookmark}
              <input class="bookmark-name" type="text" bind:value={draft} placeholder={entry.defaultLabel} title={ctrl.t.bookmarks.nameInput} aria-label={ctrl.t.bookmarks.nameInput}
                use:focusInput onkeydown={event => renameKey(event, entry.bookmark)} onblur={() => finishRename(entry.bookmark)} />
            {:else}
              <button type="button" class="bookmark-open" title={entry.title} onclick={() => ctrl.openBookmark(entry.bookmark)}>{entry.label}</button>
              {#if entry.defaultLabel}
                <button type="button" class="icon" title={ctrl.t.bookmarks.rename(entry.label)} aria-label={ctrl.t.bookmarks.rename(entry.label)} onclick={() => startRename(entry)}>✎</button>
              {/if}
            {/if}
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
