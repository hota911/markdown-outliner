<script lang="ts">
  import type { Controller, View } from './controller.svelte.ts';

  let { ctrl, view }: { ctrl: Controller; view: View } = $props();

  const toggleLabel = $derived(view.sidebarCollapsed ? 'サイドバーを展開' : 'サイドバーを縮小');
</script>

<aside class="bookmarks" class:is-collapsed={view.sidebarCollapsed} aria-label="ブックマーク">
  <div class="bookmarks-header">
    {#if !view.sidebarCollapsed}
      <h2 class="bookmarks-heading">ブックマーク</h2>
    {/if}
    <button type="button" class="icon sidebar-toggle" title={toggleLabel} aria-label={toggleLabel} aria-expanded={!view.sidebarCollapsed} onclick={ctrl.toggleSidebar}>{view.sidebarCollapsed ? '›' : '‹'}</button>
  </div>
  {#if !view.sidebarCollapsed}
    <div class="bookmark-actions">
      <button type="button" title="表示中のファイルをブックマーク" onclick={() => ctrl.addBookmark('file')}>ファイルを追加</button>
    </div>
    {#if !view.bookmarksValid}
      <p class="bookmark-empty">設定を読み込めません。</p>
    {:else}
      <ul class="bookmark-list">
        {#each view.bookmarks as entry, index (index)}
          <li class="bookmark-item">
            <button type="button" class="bookmark-open" title={entry.title} onclick={() => ctrl.openBookmark(entry.bookmark)}>{entry.label}</button>
            <button type="button" class="icon" title={entry.label + ' を削除'} aria-label={entry.label + ' を削除'} onclick={() => ctrl.removeBookmark(entry.bookmark)}>×</button>
          </li>
        {/each}
      </ul>
      {#if !view.bookmarks.length}
        <p class="bookmark-empty">ファイルや検索条件を登録できます。</p>
      {/if}
    {/if}
  {/if}
</aside>
