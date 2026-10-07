<script lang="ts">
  import Item from './Item.svelte';
  import { syncValue, type Controller, type OutlineView } from './controller.svelte.ts';

  let { ctrl, outline }: { ctrl: Controller; outline: OutlineView } = $props();

  let kind = $derived(outline.kind === 'outline' ? outline.addKind : 'task');

  function zoomEvents(field: 'title' | 'note') {
    return ctrl.fieldEvents(
      outline.kind === 'outline' ? outline.path : '',
      () => (outline.kind === 'outline' && outline.zoom ? outline.zoom.row : (undefined as never)),
      field,
    );
  }
  const zoomTitleEvents = zoomEvents('title');
  const zoomNoteEvents = zoomEvents('note');

  function append() {
    if (outline.kind !== 'outline') return;
    const { path, zoom, appendLine, appendChild } = outline;
    ctrl.add(path, zoom ? appendLine : null, appendChild, kind);
  }
</script>

{#if outline.kind === 'cycle'}
  {@const path = outline.path}
  <div class="notice">このファイルはすでに埋め込まれています。循環する埋め込みは表示できません。</div>
  <button type="button" class="quiet" title="埋め込み先のファイルを直接開く" onclick={() => ctrl.openFile(path)}>このファイルを開く</button>
{:else if outline.kind === 'missing'}
  <div class="notice">ファイルを開けません。保存先とファイル名を確認してください。</div>
{:else if outline.kind === 'outline'}
  {#if outline.zoom}
    {@const zoom = outline.zoom}
    {@const path = outline.path}
    <section class="zoom-heading">
      <textarea
        class="title-input zoom-title"
        rows="1"
        wrap="soft"
        {@attach syncValue(() => zoom.row.title)}
        placeholder="タイトルを入力"
        aria-label="ズーム対象のタイトル"
        data-path={path}
        data-line={zoom.row.line}
        data-field="title"
        {...zoomTitleEvents}
      ></textarea>
      {#if zoom.status}
        {@const status = zoom.status}
        <button type="button" class="task-status" title={status.label} aria-label={status.label} onclick={() => ctrl.setStatus(path, zoom.row.line, status.next)}>{status.icon}</button>
      {/if}
      <button type="button" class="quiet" title="ズーム対象のノートを編集" onclick={() => ctrl.showNote(path, zoom.row.line)}>ノート</button>
      {#if zoom.showNote}
        <textarea
          class="note-input zoom-note"
          {@attach syncValue(() => zoom.row.note)}
          rows={Math.max(1, Math.min(8, zoom.row.note.split('\n').length))}
          aria-label="ズーム対象のノート"
          data-path={path}
          data-line={zoom.row.line}
          data-field="note"
          {...zoomNoteEvents}
        ></textarea>
      {/if}
    </section>
  {/if}
  {#each outline.items as item (item.key)}
    <Item {ctrl} {item} />
  {/each}
  {#if !outline.items.length}
    <div class="empty">表示する項目がありません。「＋」で入力できます。</div>
  {/if}
  <div class="outline-add">
    <button type="button" class="icon append-item" title="リストの末尾に項目を追加" aria-label="リストの末尾に項目を追加" onclick={append}>＋</button>
    <select class="add-kind" aria-label="追加する項目の種類" bind:value={kind}>
      <option value="task">タスク</option>
      <option value="bullet">箇条書き</option>
    </select>
  </div>
{/if}
