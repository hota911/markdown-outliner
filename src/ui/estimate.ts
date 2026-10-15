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

// `title` with the estimate of its first pomodoro field changed by `delta`. A title without a field
// gets `[🍅:: 0/1]` before a block ID at the end, which has to stay last; a field left with no
// pomodoro done or estimated goes away, and one with pomodoros done but no estimate keeps them.
export function changeEstimate(title: string, delta: number): string {
  const field = new RegExp(pomodoroField.source, 'u').exec(title);
  if (!field) {
    if (delta <= 0) return title;
    const block = /[ \t]+\^[A-Za-z0-9-]+[ \t]*$/.exec(title), end = block ? block.index : title.trimEnd().length;
    const before = title.slice(0, end);
    return before + (before === '' || /\s$/.test(before) ? '' : ' ') + `[🍅:: 0/${delta}]` + title.slice(end);
  }
  const done = Number(field[1] || 0), estimated = Math.max(0, Number(field[2] || 0) + delta);
  const replacement = estimated > 0 ? `[🍅:: ${done}/${estimated}]` : done > 0 ? `[🍅:: ${done}]` : '';
  const before = title.slice(0, field.index), after = title.slice(field.index + field[0].length);
  if (replacement) return before + replacement + after;
  return /\s$/.test(before) && /^(\s|$)/.test(after) ? before.trimEnd() + after : before + after;
}
