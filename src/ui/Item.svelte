<script lang="ts">
  import Outline from './Outline.svelte';
  import SlashMenu from './SlashMenu.svelte';
  import type { Controller, Drop, ItemView } from './controller.svelte.ts';
  import { syncValue, tagAt, titleParts } from './controller.svelte.ts';
  import { markPieces, matchRanges, type Piece } from './filter.ts';
  import { grow } from './motion.ts';

  let { ctrl, item }: { ctrl: Controller; item: ItemView } = $props();
  const uid = $props.id();

  let editing = $state(false);
  // The links and marks follow the textarea when it loses focus, before the next render updates the row.
  let shownTitle = $derived(item.row.title);
  const marks = $derived(item.highlight ? matchRanges(shownTitle, item.highlight) : []);
  // The rendered title is laid over the textarea while it is not edited, for links, tags and filter matches.
  const overlay = $derived(item.titleParts !== null || marks.length > 0);
  const display = $derived((titleParts(shownTitle) ?? [{ text: shownTitle, start: 0 }])
    .map(part => ({ ...part, pieces: markPieces(part.text, part.start, marks) })));
  let titleNode: HTMLTextAreaElement | undefined = $state();

  const titleEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'title'));
  const slashMenu = $derived(ctrl.slashMenu(item.path, item.row.line));
  const noteEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'note'));

  const lineDrop = (node: HTMLElement) => (event: DragEvent) => ctrl.lineDrop(item.path, item.row.line, item.rootLine, node, event);
  const endDrop = (parentLine: number) => (): Drop => ({ parentLine, beforeLine: null, indicator: 'drop-after' });

  function dragOver(event: DragEvent, destination: (event: DragEvent) => Drop | null) {
    ctrl.dragOver(item.path, event.currentTarget as HTMLElement, event, destination);
  }

  function keepFocus(event: Event) {
    event.preventDefault();
  }

  // ⌘/Ctrl-click on a #tag adds it to the search. A plain click keeps placing the caret.
  function filterTag(event: MouseEvent, text: string, offset: number) {
    const tag = event.metaKey || event.ctrlKey ? tagAt(text, offset) : null;
    if (tag === null) return false;
    event.preventDefault();
    ctrl.filterByTag(tag);
    return true;
  }

  function titleClick(event: MouseEvent & { currentTarget: HTMLTextAreaElement }) {
    // The click has already put the caret where the pointer is.
    const node = event.currentTarget;
    if (node.selectionStart === node.selectionEnd && filterTag(event, node.value, node.selectionStart)) node.blur();
  }

  // The rendered text covers the textarea while it is not edited: a tag adds itself to the search,
  // and other text starts editing with the caret where it was clicked.
  function displayClick(event: MouseEvent) {
    const target = event.target as Element;
    if (target.closest('a') || !titleNode) return;
    const tag = target.closest<HTMLElement>('[data-tag]');
    if (tag) {
      ctrl.filterByTag(tag.dataset.tag!);
      return;
    }
    // Engines without caretPositionFromPoint (Safari before 18.4) put the caret at the end.
    const clicked = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const part = clicked?.offsetNode.parentElement?.closest<HTMLElement>('[data-start]');
    const position = clicked && part ? Number(part.dataset.start) + clicked.offset : titleNode.value.length;
    titleNode.focus();
    titleNode.setSelectionRange(position, position);
  }
</script>

<!-- Plain text pieces carry their offset in the title, so a click on them, marked or not, can put the caret there. -->
{#snippet marked(pieces: Piece[], plain: boolean)}{#each pieces as piece, index (index)}{#if piece.mark}<mark data-start={plain ? piece.start : undefined}>{piece.text}</mark>{:else if plain}<span data-start={piece.start}>{piece.text}</span>{:else}{piece.text}{/if}{/each}{/snippet}

<div class="outline-item" class:is-done={item.row.status === 'done'} class:is-selected={item.selected} class:is-context={item.context} style:--depth={item.depth} in:grow>
  {#if item.embed}
    <div class="outline-line">
      <button type="button" class="icon fold" title={ctrl.t.item.fold} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      <span class="embed-title">{item.row.embed}</span>
    </div>
    {#if !item.collapsed}
      <div class="embedded" in:grow>
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
      <div class="title-area" class:has-overlay={overlay} class:is-editing={editing}>
        <textarea
          bind:this={titleNode}
          class="title-input"
          rows="1"
          wrap="soft"
          {@attach syncValue(() => item.row.title)}
          placeholder={item.row.kind === 'task' ? ctrl.t.item.taskPlaceholder : ctrl.t.item.bulletPlaceholder}
          aria-label={ctrl.t.item.title}
          aria-describedby={item.context ? uid + '-context' : undefined}
          data-path={item.path}
          data-line={item.row.line}
          data-field="title"
          aria-controls={slashMenu?.id}
          aria-activedescendant={slashMenu ? slashMenu.id + '-' + slashMenu.index : undefined}
          {...titleEvents}
          onclick={titleClick}
          onfocus={event => { titleEvents.onfocus(event); editing = true; }}
          onblur={event => { editing = false; shownTitle = event.currentTarget.value; titleEvents.onblur(); }}
        ></textarea>
        {#if item.context}
          <span id={uid + '-context'} class="visually-hidden">{ctrl.t.item.filterContext}</span>
        {/if}
        {#if slashMenu}
          <SlashMenu {ctrl} menu={slashMenu} />
        {/if}
        {#if overlay}
          <!-- The textarea stays the keyboard target; clicking the rendered text only forwards focus. -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="title-display" onclick={displayClick}>
            {#each display as part, index (index)}{#if part.href}<a href={part.href} target="_blank" rel="noopener noreferrer">{@render marked(part.pieces, false)}</a>{:else if part.tag}<span class="tag" data-tag={part.tag}>{@render marked(part.pieces, false)}</span>{:else}{@render marked(part.pieces, true)}{/if}{/each}
          </div>
        {/if}
      </div>
      <!-- A press keeps the focus where it is: focus decides where the buttons sit (see styles.css), and a
           button that moved between the press and the release would get no click. The keyboard still
           reaches them with Tab. -->
      <div class="row-actions" onpointerdown={keepFocus} onmousedown={keepFocus}>
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
      <textarea
        class="note-input"
        {@attach syncValue(() => item.row.note)}
        placeholder={ctrl.t.item.notePlaceholder}
        rows={Math.max(1, Math.min(8, item.row.note.split('\n').length))}
        aria-label={ctrl.t.item.noteLabel}
        data-path={item.path}
        data-line={item.row.line}
        data-field="note"
        {...noteEvents}
      ></textarea>
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
