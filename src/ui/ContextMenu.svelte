<script lang="ts">
  import type { ContextMenu, Controller } from './controller.svelte.ts';

  let { ctrl, menu }: { ctrl: Controller; menu: ContextMenu } = $props();

  // Keeps the menu inside the window, takes the focus, and closes on a press elsewhere, a scroll or a resize.
  const place = (node: HTMLElement) => {
    const view = node.ownerDocument.defaultView!;
    const { width, height } = node.getBoundingClientRect();
    node.style.left = Math.max(0, Math.min(menu.x, view.innerWidth - width)) + 'px';
    node.style.top = Math.max(0, Math.min(menu.y, view.innerHeight - height)) + 'px';
    node.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const pressed = (event: Event) => { if (!node.contains(event.target as Node)) ctrl.closeContextMenu(); };
    const close = () => ctrl.closeContextMenu();
    node.ownerDocument.addEventListener('pointerdown', pressed, true);
    node.ownerDocument.addEventListener('scroll', close, true);
    view.addEventListener('resize', close);
    view.addEventListener('blur', close);
    return () => {
      node.ownerDocument.removeEventListener('pointerdown', pressed, true);
      node.ownerDocument.removeEventListener('scroll', close, true);
      view.removeEventListener('resize', close);
      view.removeEventListener('blur', close);
    };
  };

  function keydown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.indexOf(event.target as HTMLElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      ctrl.closeContextMenu(true);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      ctrl.closeContextMenu(true);
    }
  }
</script>

<div class="context-menu" role="menu" tabindex="-1" aria-label={ctrl.t.slash.commands} onkeydown={keydown} oncontextmenu={event => event.preventDefault()} {@attach place}>
  {#each menu.options as option (option.id)}
    <button type="button" role="menuitem" tabindex="-1" onclick={() => void ctrl.runContextCommand(option.id)}>{option.label}</button>
  {/each}
</div>
