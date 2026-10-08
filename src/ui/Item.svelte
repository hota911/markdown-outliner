<script lang="ts">
  import EmbedRow from './EmbedRow.svelte';
  import InlineText from './InlineText.svelte';
  import SlashMenu from './SlashMenu.svelte';
  import type { Controller, Drop, ItemView } from './controller.svelte.ts';
  import { syncNote, syncValue } from './controller.svelte.ts';
  import { matchRanges } from './filter.ts';
  import { parseInline } from './inline.ts';
  import { grow } from './motion.ts';

  let { ctrl, item }: { ctrl: Controller; item: ItemView } = $props();
  const uid = $props.id();

  let editing = $state(false);
  let noteEditing = $state(false);
  // The rendered text follows the textarea when it loses focus, before the next render updates the row.
  let shownTitle = $derived(item.row.title);
  let shownNote = $derived(item.row.note);
  const display = $derived(parseInline(shownTitle));
  const noteDisplay = $derived(parseInline(shownNote));
  const marks = $derived(item.highlight ? matchRanges(shownTitle, item.highlight) : []);
  // The rendered title is laid over the textarea while it is not edited, for inline Markdown, tags
  // and filter matches.
  const overlay = $derived(display !== null || marks.length > 0);
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

  // The row line is a drop target, both for an embed row and for any other row.
  type LineEvent = DragEvent & { currentTarget: HTMLElement };
  const lineEvents = {
    ondragover: (event: LineEvent) => dragOver(event, lineDrop(event.currentTarget)),
    ondragleave: () => ctrl.clearDrop(),
    ondrop: (event: LineEvent) => ctrl.drop(item.path, event, lineDrop(event.currentTarget)),
  };

  function keepFocus(event: Event) {
    event.preventDefault();
  }

  // The tag (without `#`) of the whitespace-separated word around `offset`, or null when that word
  // is not a tag. A word counts as a tag exactly when the search box would treat it as one.
  function tagAt(text: string, offset: number): string | null {
    const word = text.slice(0, offset).match(/\S*$/)![0] + text.slice(offset).match(/^\S*/)![0];
    return /^#[^#\s]+$/.test(word) ? word.slice(1) : null;
  }

  // ⌘/Ctrl-click on a #tag adds it to the search. A plain click keeps placing the caret.
  function filterTag(event: MouseEvent, text: string, offset: number) {
    const tag = event.metaKey || event.ctrlKey ? tagAt(text, offset) : null;
    if (tag === null) return false;
    event.preventDefault();
    ctrl.filterByTag(tag);
    return true;
  }

  function fieldClick(event: MouseEvent & { currentTarget: HTMLTextAreaElement }) {
    // The click has already put the caret where the pointer is.
    const node = event.currentTarget;
    if (node.selectionStart === node.selectionEnd && filterTag(event, node.value, node.selectionStart)) node.blur();
  }

  // The first non-empty text after `node` inside `root`.
  function nextText(root: Node, node: Node): Text | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    for (let next = walker.nextNode() as Text | null; next; next = walker.nextNode() as Text | null) {
      if (next.data) return next;
    }
    return null;
  }

  // The rendered text covers its textarea while it is not edited: links keep their own click, a tag
  // adds itself to the search, and other text starts editing with the caret at the clicked
  // character. Where the engine has no caretPositionFromPoint (Safari before 18.4), or the click is
  // not on text, the caret goes to the end.
  function displayClick(event: MouseEvent & { currentTarget: HTMLElement }, field: HTMLTextAreaElement | undefined) {
    const target = event.target as Element;
    if (target.closest('a') || !field) return;
    const tag = target.closest<HTMLElement>('[data-tag]');
    if (tag) {
      ctrl.filterByTag(tag.dataset.tag!);
      return;
    }
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const clicked = caret?.offsetNode.nodeType === Node.TEXT_NODE ? caret.offsetNode as Text : null;
    const leaf = clicked?.parentElement?.closest<HTMLElement>('[data-start]');
    let offset = caret && leaf ? Number(leaf.dataset.start) + caret.offset : field.value.length;
    if (caret && clicked && leaf && caret.offset === clicked.data.length) {
      // At the end of the last text of a line, the caret also goes past the closing markers
      // (`**`, a backtick), so Enter or typing at the end of the line stays outside the markup.
      // Only text and code start with a line break, and their pieces carry an offset.
      const next = nextText(event.currentTarget, clicked);
      if (!next) offset = field.value.length;
      else if (next.data.startsWith('\n')) offset = Number(next.parentElement!.closest<HTMLElement>('[data-start]')!.dataset.start);
    }
    field.focus();
    field.setSelectionRange(offset, offset);
  }
</script>

{#snippet handle()}
  <button
    type="button"
    class="icon drag-handle"
    title={ctrl.t.item.dragHandle}
    aria-pressed={item.selected}
    draggable="true"
    data-path={item.path}
    data-line={item.row.line}
    onclick={event => ctrl.selectRow(item.path, item.row, event)}
    onkeydown={event => ctrl.handleKeydown(item.path, item.row, event)}
    ondragstart={event => ctrl.dragStart(item.path, item.row, event)}
    ondragend={ctrl.dragEnd}
  >⠿</button>
{/snippet}

<div class="outline-item" class:is-done={item.row.status === 'done'} class:is-selected={item.selected} class:is-context={item.context} style:--depth={item.depth} in:grow>
  {#if item.embed}
    <EmbedRow {ctrl} {item} embed={item.embed} {handle} {lineEvents} />
  {:else}
    <!-- Drop target only; dragging is started from the handle button. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="outline-line" {...lineEvents}>
      <button type="button" class="icon fold" title={ctrl.t.item.fold} disabled={!item.hasChildren} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      {@render handle()}
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
          onclick={fieldClick}
          onfocus={event => { titleEvents.onfocus(event); editing = true; }}
          onblur={event => { editing = false; shownTitle = event.currentTarget.value; titleEvents.onblur(event); }}
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
          <div class="title-display" onclick={event => displayClick(event, titleNode)}><InlineText nodes={display ?? [{ kind: 'text', text: shownTitle, start: 0 }]} {marks} /></div>
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
      <div class="note-area" class:has-overlay={noteDisplay !== null} class:is-editing={noteEditing}>
        <textarea
          bind:this={noteNode}
          class="note-input"
          {@attach syncNote(() => item.row.note)}
          placeholder={ctrl.t.item.notePlaceholder}
          rows={Math.max(1, Math.min(8, item.row.note.split('\n').length))}
          aria-label={ctrl.t.item.noteLabel}
          data-path={item.path}
          data-line={item.row.line}
          data-field="note"
          {...noteEvents}
          onclick={fieldClick}
          onfocus={event => { noteEvents.onfocus(event); noteEditing = true; }}
          onblur={event => { noteEditing = false; noteEvents.onblur(event); shownNote = event.currentTarget.value; }}
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
