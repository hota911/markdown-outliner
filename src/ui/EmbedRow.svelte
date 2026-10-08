<script lang="ts">
  import type { Snippet } from 'svelte';
  import Outline from './Outline.svelte';
  import type { Controller, ItemView } from './controller.svelte.ts';
  import { grow } from './motion.ts';

  type LineEvent = DragEvent & { currentTarget: HTMLElement };
  // The drop handlers of the row line, shared with the other rows (see Item.svelte).
  interface LineEvents { ondragover: (event: LineEvent) => void; ondragleave: () => void; ondrop: (event: LineEvent) => void }

  // `embed` is `item.embed`, which is set for an embed row.
  let { ctrl, item, embed, handle, lineEvents }: { ctrl: Controller; item: ItemView; embed: NonNullable<ItemView['embed']>; handle: Snippet; lineEvents: LineEvents } = $props();

  // The embed heading itself turns into the rename field: only the base name is edited; the folder
  // and .md stay as text around it.
  let renaming = $state(false);
  const embedFolder = (name: string) => /^.*[/\\]/.exec(name)?.[0] ?? '';
  const baseName = (name: string) => name.slice(embedFolder(name).length).replace(/\.md$/, '');
  const focusAll = (node: HTMLInputElement) => { node.focus(); node.select(); };

  function renameKey(event: KeyboardEvent) {
    // Keeps outline shortcuts from acting on the item while the name is typed.
    event.stopPropagation();
    // keyCode 229 is the only IME signal some browsers give for the key that ends composition.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); renaming = false; return; }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = (event.currentTarget as HTMLInputElement).value;
    renaming = false;
    void ctrl.renameEmbed(item.path, item.row.line, value);
  }
</script>

<div class="outline-line" {...lineEvents}>
  <button type="button" class="icon fold" title={ctrl.t.item.fold} onclick={() => ctrl.toggleFold(item.path, item.row.line)}>{item.collapsed ? '▸' : '▾'}</button>
  {@render handle()}
  {#if renaming}
    {@const name = item.row.embed!}
    <span class="embed-title is-renaming">{embedFolder(name)}<input
        class="embed-rename"
        aria-label={ctrl.t.outline.renameLabel(name)}
        title={ctrl.t.outline.renameHint}
        value={baseName(name)}
        {@attach focusAll}
        onkeydown={renameKey}
        onblur={() => { renaming = false; }}
      /><span class="rename-suffix">.md</span></span>
  {:else}
    <span class="embed-title">{item.row.embed}</span>
  {/if}
</div>
{#if !item.collapsed}
  <div class="embedded" in:grow>
    {#if embed.error !== null}
      <div class="notice">{embed.error}</div>
    {:else}
      {@const target = embed.target!}
      <div class="embed-actions">
        <button type="button" class="quiet" title={ctrl.t.outline.openEmbeddedTitle} onclick={() => ctrl.openFile(target)}>{ctrl.t.outline.openEmbedded}</button>
        {#if ctrl.canRename && embed.outline?.kind === 'outline'}
          <button type="button" class="quiet" title={ctrl.t.outline.renameTitle} onclick={() => { renaming = true; }}>{ctrl.t.outline.rename}</button>
        {/if}
      </div>
      <Outline {ctrl} outline={embed.outline!} />
    {/if}
  </div>
{/if}
