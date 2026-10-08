// jsdom does not implement layout APIs; arrow-key navigation calls scrollIntoView.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
// Nor ResizeObserver, which Svelte uses to measure the pinned header (bind:offsetHeight in Outliner.svelte).
if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// jsdom has neither matchMedia nor animations, so the tests run as with reduced motion, which makes
// the transitions in src/ui/motion.ts instant. The e2e tests cover the animated case in a browser.
if (!window.matchMedia) {
  window.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query, addEventListener() {}, removeEventListener() {} });
}
