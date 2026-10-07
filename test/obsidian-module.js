// The obsidian npm package ships type declarations only; Obsidian provides the module at
// runtime. Vitest resolves 'obsidian' here, and tests replace it with vi.mock('obsidian').
export {};
