<script lang="ts">
  import { markPieces } from './filter.ts';
  import type { Inline } from './inline.ts';

  // `marks` are [start, end) ranges of the source to highlight, such as the filter matches.
  let { nodes, marks = [] }: { nodes: Inline[]; marks?: [number, number][] } = $props();
</script>

<!-- Kept on one line each: the display uses pre-wrap, so whitespace between tags would show. -->
<!-- Text pieces carry their offset in the source, marked or not, so that a click on them can put the caret there. A tag is clicked to filter instead, so its text carries no offset. -->
{#snippet pieces(text: string, start: number, offsets: boolean)}{#each markPieces(text, start, marks) as piece, index (index)}{#if piece.mark}<mark data-start={offsets ? piece.start : undefined}>{piece.text}</mark>{:else if offsets}<span data-start={piece.start}>{piece.text}</span>{:else}{piece.text}{/if}{/each}{/snippet}
{#snippet render(nodes: Inline[])}{#each nodes as node, index (index)}{#if node.kind === 'text'}{@render pieces(node.text, node.start, true)}{:else if node.kind === 'code'}<code>{@render pieces(node.text, node.start, true)}</code>{:else if node.kind === 'tag'}<span class="tag" data-tag={node.tag}>{@render pieces(node.text, node.start, false)}</span>{:else if node.kind === 'link'}<a href={node.href} target="_blank" rel="noopener noreferrer">{@render render(node.children)}</a>{:else if node.kind === 'strong' || node.kind === 'em' || node.kind === 'del'}<svelte:element this={node.kind}>{@render render(node.children)}</svelte:element>{/if}{/each}{/snippet}
{@render render(nodes)}
