<script lang="ts">
  import InlineText from './InlineText.svelte';
  import Outline from './Outline.svelte';
  import SlashMenu from './SlashMenu.svelte';
  import type { Controller, Drop, ItemView } from './controller.svelte.ts';
  import { syncValue } from './controller.svelte.ts';
  import { parseInline } from './inline.ts';

  let { ctrl, item }: { ctrl: Controller; item: ItemView } = $props();

  let editing = $state(false);
  let noteEditing = $state(false);
  // The rendered text follows the textarea when it loses focus, before the next render updates the row.
  let shownTitle = $derived(item.row.title);
  let shownNote = $derived(item.row.note);
  const display = $derived(parseInline(shownTitle));
  const noteDisplay = $derived(parseInline(shownNote));
  let titleNode: HTMLTextAreaElement | undefined = $state();
  let noteNode: HTMLTextAreaElement | undefined = $state();

  const titleEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'title'));
  const slashMenu = $derived(ctrl.slashMenu(item.path, item.row.line));
  const noteEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'note'));

  const lineDrop = (node: HTMLElement) => (event: DragEvent) => ctrl.lineDrop(item.path, item.row.line, item.rootLine, node, event);
  const endDrop = (parentLine: number) => (): Drop => ({ parentLine, beforeLine: null, indicator: 'drop-after' });

  function dragOver(event: DragEvent, destination: (event: DragEvent) => Drop | null) {
    ctrl.dragOver(item.path, event.currentTarget as HTMLElement, event, destination);
  }

  // The rendered text covers its textarea, so a click on it starts editing with the caret at the
  // clicked character. Links keep their own click. Where the engine has no caretPositionFromPoint
  // (Safari before 18.4), or the click is not on text, the caret goes to the end.
  function displayClick(event: MouseEvent, field: HTMLTextAreaElement | undefined) {
    if ((event.target as Element).closest('a') || !field) return;
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const leaf = caret?.offsetNode.nodeType === Node.TEXT_NODE ? caret.offsetNode.parentElement?.closest<HTMLElement>('[data-start]') : null;
    const offset = caret && leaf ? Number(leaf.dataset.start) + caret.offset : field.value.length;
    field.focus();
    field.setSelectionRange(offset, offset);
  }
</script>

<div class="outline-item" class:is-done={item.row.status === 'done'} class:is-selected={item.selected} style:--depth={item.depth}>
  {#if item.embed}
    <div class="outline-line">
      <button type="button" class="icon fold" title={ctrl.t.item.fold} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      <span class="embed-title">{item.row.embed}</span>
    </div>
    {#if !item.collapsed}
      <div class="embedded">
        <div class="source-label">{ctrl.t.item.embedSource(item.row.embed!)}</div>
        {#if item.embed.error !== null}
          <div class="notice">{item.embed.error}</div>
        {:else}
          {@const target = item.embed.target!}
          <button type="button" class="quiet" title={ctrl.t.outline.openEmbeddedTitle} onclick={() => ctrl.openFile(target)}>{ctrl.t.outline.openEmbedded}</button>
          <Outline {ctrl} outline={item.embed.outline!} />
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Drop target only; dragging is started from the handle button. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="outline-line"
      ondragover={event => dragOver(event, lineDrop(event.currentTarget))}
      ondragleave={ctrl.clearDrop}
      ondrop={event => ctrl.drop(item.path, event, lineDrop(event.currentTarget))}
    >
      <button type="button" class="icon fold" title={ctrl.t.item.fold} disabled={!item.hasChildren} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      <button
        type="button"
        class="icon drag-handle"
        title={ctrl.t.item.dragHandle}
        aria-pressed={item.selected}
        draggable="true"
        onclick={event => ctrl.selectRow(item.path, item.row, event)}
        ondragstart={event => ctrl.dragStart(item.path, item.row, event)}
        ondragend={ctrl.dragEnd}
      >⠿</button>
      {#if item.status}
        {@const status = item.status}
        <button type="button" class="task-status" title={status.label} aria-label={status.label} data-status={item.row.status} onclick={() => ctrl.setStatus(item.path, item.row.line, status.next)}>{status.icon}</button>
      {:else}
        <span class="bullet">•</span>
      {/if}
      <div class="title-area" class:has-markup={display !== null} class:is-editing={editing}>
        <textarea
          bind:this={titleNode}
          class="title-input"
          rows="1"
          wrap="soft"
          {@attach syncValue(() => item.row.title)}
          placeholder={item.row.kind === 'task' ? ctrl.t.item.taskPlaceholder : ctrl.t.item.bulletPlaceholder}
          aria-label={ctrl.t.item.title}
          data-path={item.path}
          data-line={item.row.line}
          data-field="title"
          aria-controls={slashMenu?.id}
          aria-activedescendant={slashMenu ? slashMenu.id + '-' + slashMenu.index : undefined}
          {...titleEvents}
          onfocus={event => { titleEvents.onfocus(event); editing = true; }}
          onblur={event => { editing = false; shownTitle = event.currentTarget.value; titleEvents.onblur(); }}
        ></textarea>
        {#if slashMenu}
          <SlashMenu {ctrl} menu={slashMenu} />
        {/if}
        {#if display !== null}
          <!-- The textarea stays the keyboard target; clicking the rendered text only forwards focus. -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="title-display" onclick={event => displayClick(event, titleNode)}><InlineText nodes={display} /></div>
        {/if}
      </div>
      <div class="row-actions">
        <button type="button" class="icon" title={item.row.kind === 'task' ? ctrl.t.item.addChildTask : ctrl.t.item.addChildBullet} onclick={() => ctrl.add(item.path, item.row.line, true)}>+</button>
        <!-- On touch screens the buttons marked in-touch-bar are hidden; the touch bar has the same commands. -->
        <button type="button" class="quiet in-touch-bar" title={ctrl.t.item.editNoteTitle} onclick={() => ctrl.showNote(item.path, item.row.line)}>{ctrl.t.item.note}</button>
        <button type="button" class="icon" title={ctrl.t.item.zoomIn} onclick={() => ctrl.zoomTo(item.path, item.row.line)}>↗</button>
        <button type="button" class="icon in-touch-bar" title={ctrl.t.item.moveUp} onclick={() => ctrl.moveRow(item.path, item.row.line, 'up')}>↑</button>
        <button type="button" class="icon in-touch-bar" title={ctrl.t.item.moveDown} onclick={() => ctrl.moveRow(item.path, item.row.line, 'down')}>↓</button>
        <button type="button" class="quiet" title={ctrl.t.item.extractTitle} onclick={() => ctrl.extractToFile(item.path, item.row.line)}>{ctrl.t.item.extract}</button>
      </div>
    </div>
    {#if item.showNote}
      <div class="note-area" class:has-markup={noteDisplay !== null} class:is-editing={noteEditing}>
        <textarea
          bind:this={noteNode}
          class="note-input"
          {@attach syncValue(() => item.row.note)}
          placeholder={ctrl.t.item.notePlaceholder}
          rows={Math.max(1, Math.min(8, item.row.note.split('\n').length))}
          aria-label={ctrl.t.item.noteLabel}
          data-path={item.path}
          data-line={item.row.line}
          data-field="note"
          {...noteEvents}
          onfocus={event => { noteEvents.onfocus(event); noteEditing = true; }}
          onblur={event => { noteEditing = false; shownNote = event.currentTarget.value; noteEvents.onblur(); }}
        ></textarea>
        {#if noteDisplay !== null}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="note-display" onclick={event => displayClick(event, noteNode)}><InlineText nodes={noteDisplay} /></div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
{#each item.ends as end (end.key)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="children-end"
    style:--depth={end.depth}
    aria-label={end.label}
    ondragover={event => dragOver(event, endDrop(end.parentLine))}
    ondragleave={ctrl.clearDrop}
    ondrop={event => ctrl.drop(item.path, event, endDrop(end.parentLine))}
  ></div>
{/each}
