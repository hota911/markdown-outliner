<script lang="ts">
  import type { Controller, SlashMenu } from './controller.svelte.ts';

  let { ctrl, menu }: { ctrl: Controller; menu: SlashMenu } = $props();

  // The title keeps the focus, so typing goes on filtering while the pointer picks an option.
  function keepFocus(event: Event) {
    event.preventDefault();
  }

  const showActive = (active: boolean) => (node: HTMLElement) => {
    if (active) node.scrollIntoView({ block: 'nearest' });
  };
</script>

<!-- The title textarea handles the keys and points at the highlighted option with aria-activedescendant. -->
<div class="slash-menu" id={menu.id} role="listbox" tabindex="-1" aria-label={menu.label} onpointerdown={keepFocus} onmousedown={keepFocus}>
  {#each menu.options as option, index (option.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      id={menu.id + '-' + index}
      class="slash-option"
      class:is-active={index === menu.index}
      role="option"
      tabindex="-1"
      aria-selected={index === menu.index}
      {@attach showActive(index === menu.index)}
      onclick={() => void ctrl.runSlash(option.id)}
    >{option.label}</div>
  {/each}
</div>
