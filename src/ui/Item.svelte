<script lang="ts">
  import Outline from './Outline.svelte';
  import type { Controller, Drop, ItemView } from './controller.svelte.ts';
  import { linkParts, syncValue } from './controller.svelte.ts';

  let { ctrl, item }: { ctrl: Controller; item: ItemView } = $props();

  let editing = $state(false);
  // The links follow the textarea when it loses focus, before the next render updates the row.
  let shownTitle = $derived(item.row.title);
  const display = $derived(linkParts(shownTitle) ?? [{ text: shownTitle }]);
  let titleNode: HTMLTextAreaElement | undefined = $state();

  const titleEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'title'));
  const noteEvents = $derived(ctrl.fieldEvents(item.path, () => item.row, 'note'));

  const lineDrop = (node: HTMLElement) => (event: DragEvent) => ctrl.lineDrop(item.path, item.row.line, item.rootLine, node, event);
  const endDrop = (parentLine: number) => (): Drop => ({ parentLine, beforeLine: null, indicator: 'drop-after' });

  function dragOver(event: DragEvent, destination: (event: DragEvent) => Drop | null) {
    ctrl.dragOver(item.path, event.currentTarget as HTMLElement, event, destination);
  }

  function displayClick(event: MouseEvent) {
    if ((event.target as Element).closest('a') || !titleNode) return;
    titleNode.focus();
    titleNode.setSelectionRange(titleNode.value.length, titleNode.value.length);
  }
</script>

<div class="outline-item" class:is-done={item.row.status === 'done'} class:is-selected={item.selected} style:--depth={item.depth}>
  {#if item.embed}
    <div class="outline-line">
      <button type="button" class="icon fold" title="子項目を折りたたむ／開く" onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      <span class="embed-title">{item.row.embed}</span>
    </div>
    {#if !item.collapsed}
      <div class="embedded">
        <div class="source-label">ファイル: {item.row.embed}</div>
        {#if item.embed.error !== null}
          <div class="notice">{item.embed.error}</div>
        {:else}
          {@const target = item.embed.target!}
          <button type="button" class="quiet" title="埋め込み先のファイルを直接開く" onclick={() => ctrl.openFile(target)}>このファイルを開く</button>
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
      <button type="button" class="icon fold" title="子項目を折りたたむ／開く" disabled={!item.hasChildren} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
      <button
        type="button"
        class="icon drag-handle"
        title="項目を選択／ドラッグして移動"
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
      <div class="title-area" class:has-links={item.links !== null} class:is-editing={editing}>
        <textarea
          bind:this={titleNode}
          class="title-input"
          rows="1"
          wrap="soft"
          {@attach syncValue(() => item.row.title)}
          placeholder={item.row.kind === 'task' ? 'タスクを入力' : '箇条書きを入力'}
          aria-label="項目の内容"
          data-path={item.path}
          data-line={item.row.line}
          data-field="title"
          {...titleEvents}
          onfocus={event => { titleEvents.onfocus(event); editing = true; }}
          onblur={event => { editing = false; shownTitle = event.currentTarget.value; titleEvents.onblur(); }}
        ></textarea>
        {#if item.links !== null}
          <!-- The textarea stays the keyboard target; clicking the rendered text only forwards focus. -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="title-display" onclick={displayClick}>
            {#each display as part, index (index)}{#if part.href}<a href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>{:else}{part.text}{/if}{/each}
          </div>
        {/if}
      </div>
      <div class="row-actions">
        <button type="button" class="icon" title={item.row.kind === 'task' ? '子タスクを追加' : '子の箇条書きを追加'} onclick={() => ctrl.add(item.path, item.row.line, true)}>+</button>
        <button type="button" class="quiet" title="ノートを編集" onclick={() => ctrl.showNote(item.path, item.row.line)}>ノート</button>
        <button type="button" class="icon" title="この項目にズーム" onclick={() => ctrl.zoomTo(item.path, item.row.line)}>↗</button>
        <button type="button" class="icon" title="項目を上へ移動" onclick={() => ctrl.moveRow(item.path, item.row.line, 'up')}>↑</button>
        <button type="button" class="icon" title="項目を下へ移動" onclick={() => ctrl.moveRow(item.path, item.row.line, 'down')}>↓</button>
        <button type="button" class="quiet" title="項目を子とノートごと新しいファイルへ移して埋め込みにする" onclick={() => ctrl.extractToFile(item.path, item.row.line)}>ファイルにする</button>
      </div>
    </div>
    {#if item.showNote}
      <textarea
        class="note-input"
        {@attach syncValue(() => item.row.note)}
        placeholder="ノートを入力"
        rows={Math.max(1, Math.min(8, item.row.note.split('\n').length))}
        aria-label="項目のノート"
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
