<script lang="ts">
  import Item from './Item.svelte';
  import SlashMenu from './SlashMenu.svelte';
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
  // Derived so that the handlers follow `outline.path` when this component is reused for another file.
  const zoomTitleEvents = $derived(zoomEvents('title'));
  const zoomNoteEvents = $derived(zoomEvents('note'));

  function append() {
    if (outline.kind !== 'outline') return;
    const { path, zoom, appendLine, appendChild } = outline;
    ctrl.add(path, zoom ? appendLine : null, appendChild, kind);
  }
</script>

{#if outline.kind === 'cycle'}
  {@const path = outline.path}
  <div class="notice">{ctrl.t.outline.cycle}</div>
  <button type="button" class="quiet" title={ctrl.t.outline.openEmbeddedTitle} onclick={() => ctrl.openFile(path)}>{ctrl.t.outline.openEmbedded}</button>
{:else if outline.kind === 'missing'}
  <div class="notice">{ctrl.t.outline.missing}</div>
{:else if outline.kind === 'outline'}
  {#if outline.zoom}
    {@const zoom = outline.zoom}
    {@const path = outline.path}
    {@const slashMenu = ctrl.slashMenu(path, zoom.row.line)}
    <section class="zoom-heading">
      <textarea
        class="title-input zoom-title"
        rows="1"
        wrap="soft"
        {@attach syncValue(() => zoom.row.title)}
        placeholder={ctrl.t.outline.zoomTitlePlaceholder}
        aria-label={ctrl.t.outline.zoomTitle}
        data-path={path}
        data-line={zoom.row.line}
        data-field="title"
        aria-controls={slashMenu?.id}
        aria-activedescendant={slashMenu ? slashMenu.id + '-' + slashMenu.index : undefined}
        {...zoomTitleEvents}
      ></textarea>
      {#if slashMenu}
        <SlashMenu {ctrl} menu={slashMenu} />
      {/if}
      {#if zoom.status}
        {@const status = zoom.status}
        <button type="button" class="task-status" title={status.label} aria-label={status.label} onclick={() => ctrl.setStatus(path, zoom.row.line, status.next)}>{status.icon}</button>
      {/if}
      <button type="button" class="quiet" title={ctrl.t.outline.zoomNoteTitle} onclick={() => ctrl.showNote(path, zoom.row.line)}>{ctrl.t.item.note}</button>
      {#if zoom.showNote}
        <textarea
          class="note-input zoom-note"
          {@attach syncValue(() => zoom.row.note)}
          rows={Math.max(1, Math.min(8, zoom.row.note.split('\n').length))}
          aria-label={ctrl.t.outline.zoomNote}
          data-path={path}
          data-line={zoom.row.line}
          data-field="note"
          {...zoomNoteEvents}
        ></textarea>
      {/if}
    </section>
  {/if}
  <!-- Opening another file or zooming rebuilds the list, so only items added within the same list
       play their local intro, not every item of the new one. -->
  {#key outline.path + '\n' + (outline.zoom?.row.key ?? '')}
    {#each outline.items as item (item.key)}
      <Item {ctrl} {item} />
    {/each}
  {/key}
  {#if !outline.items.length}
    <div class="empty">{ctrl.t.outline.empty}</div>
  {/if}
  <div class="outline-add">
    <button type="button" class="icon append-item" title={ctrl.t.outline.append} aria-label={ctrl.t.outline.append} onclick={append}>＋</button>
    <select class="add-kind" aria-label={ctrl.t.outline.addKind} bind:value={kind}>
      <option value="task">{ctrl.t.outline.task}</option>
      <option value="bullet">{ctrl.t.outline.bullet}</option>
    </select>
  </div>
{/if}
