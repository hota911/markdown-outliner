import { mount, unmount } from 'svelte';
import Outliner from './Outliner.svelte';
import { Controller } from './controller.svelte.ts';
import type { MountOptions, Mounted } from './types.ts';

// Renders the outliner into `container` and returns the handle used by the Obsidian view and the web app.
export function mountOutliner(container: HTMLElement, options: MountOptions): Mounted {
  const ctrl = new Controller(options);
  container.classList.add('outliner');
  // Undo and save shortcuts only apply while focus is inside the outliner.
  container.addEventListener('keydown', ctrl.keyboard);
  const component = mount(Outliner, { target: container, props: { ctrl } });
  ctrl.attach(container);
  return {
    completeActive: ctrl.completeActive,
    destroy() {
      ctrl.destroy();
      container.removeEventListener('keydown', ctrl.keyboard);
      void unmount(component);
    },
  };
}
