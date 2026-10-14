// Pomodoro counts written in titles as `[🍅:: done/estimated]`, the field the pomodoro-timer
// Obsidian plugin reads and updates. `[🍅:: 3]` has no estimate.
export interface Estimate {
  done: number;
  estimated: number;
  // False when no counted field had an estimate, so only the done count is shown.
  hasEstimate: boolean;
}

export const pomodoroField = /\[🍅::[ \t]*(\d*)[ \t]*(?:\/[ \t]*(\d*)[ \t]*)?\]/gu;

export function addEstimates(a: Estimate | null, b: Estimate | null): Estimate | null {
  if (!a || !b) return a ?? b;
  return { done: a.done + b.done, estimated: a.estimated + b.estimated, hasEstimate: a.hasEstimate || b.hasEstimate };
}

// The sum of the fields in one title, or null without any.
export function estimateOf(title: string): Estimate | null {
  let total: Estimate | null = null;
  for (const match of title.matchAll(pomodoroField)) {
    total = addEstimates(total, {
      done: Number(match[1] || 0),
      estimated: Number(match[2] || 0),
      hasEstimate: match[2] !== undefined,
    });
  }
  return total;
}

export const estimateLabel = (estimate: Estimate) => '🍅 ' + estimate.done + (estimate.hasEstimate ? '/' + estimate.estimated : '');
