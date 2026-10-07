import { cubicOut } from 'svelte/easing';
import { fade, slide, type TransitionConfig } from 'svelte/transition';

// Keep in sync with the sidebar transition in styles.css.
const duration = 150;

// Asked of the node's own window when a transition starts, not at import: the plugin module is
// loaded before any window is used, and Obsidian pop-out windows have their own.
function reducedMotion(node: Element) {
  return node.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
}

// Intro only: the node is in the DOM and focusable from the first frame, so focusing a new item
// right after a render is not delayed. There are no outros on purpose: a leaving item would stay in
// the DOM with its old data-line and text field while it fades, and the focus lookup in render(),
// arrow-key navigation and the tests would find it.
export function grow(node: Element): TransitionConfig {
  if (reducedMotion(node)) return { duration: 0 };
  const { css } = slide(node, { duration, easing: cubicOut });
  return { duration, easing: cubicOut, css: (t, u) => `${css!(t, u)}; opacity: ${t};` };
}

export function fadeIn(node: Element): TransitionConfig {
  return fade(node, { duration: reducedMotion(node) ? 0 : duration });
}
