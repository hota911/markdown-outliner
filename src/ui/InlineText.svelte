<script lang="ts">
  import type { Inline } from './inline.ts';

  let { nodes }: { nodes: Inline[] } = $props();
</script>

<!-- Kept on one line each: the display uses pre-wrap, so whitespace between tags would show. -->
{#snippet render(nodes: Inline[])}{#each nodes as node, index (index)}{#if node.kind === 'text'}<span data-start={node.start}>{node.text}</span>{:else if node.kind === 'code'}<code data-start={node.start}>{node.text}</code>{:else if node.kind === 'link'}<a href={node.href} target="_blank" rel="noopener noreferrer">{@render render(node.children)}</a>{:else if node.kind === 'strong' || node.kind === 'em' || node.kind === 'del'}<svelte:element this={node.kind}>{@render render(node.children)}</svelte:element>{/if}{/each}{/snippet}
{@render render(nodes)}
