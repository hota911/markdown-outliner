// Recurring tasks written in the Obsidian Tasks plugin's emoji format: `🔁 every week` with
// `📅` due, `⏳` scheduled and `🛫` start dates. The rules follow Tasks (and the rrule library it
// uses), so a file edited here and in Tasks gets the same next occurrence. Dates are `YYYY-MM-DD`
// strings and all arithmetic is on whole days, so the result does not depend on the time zone.

export interface Rule {
  unit: 'day' | 'week' | 'month' | 'year';
  interval: number;
  // 0 is Monday. Only for 'week'.
  weekdays: number[] | null;
  // Only for 'month'.
  monthDay: number | null;
  // `when done`: count from the day the task is completed instead of its dates.
  whenDone: boolean;
}

const names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const field = (symbols: string, value: string) => new RegExp('[ \\t]*(?:' + symbols + ')\\uFE0F?[ \\t]*' + value, 'u');
const date = '(\\d{4}-\\d{2}-\\d{2})';
const dateFields = { due: field('📅|📆|🗓', date), scheduled: field('⏳|⌛', date), start: field('🛫', date) };
const recurrence = field('🔁', '([a-zA-Z0-9, !]+)');
// Fields that belong to one occurrence only. Tasks also drops the created date unless its
// "Set created date on every added task" setting is on.
const dropped = [field('✅', date), field('❌', date), field('➕', date), field('🆔', '[a-zA-Z0-9-_]+'), field('⛔', '[a-zA-Z0-9-_]+(?: *, *[a-zA-Z0-9-_]+)*')];
const blockLink = /[ \t]+\^[a-zA-Z0-9-]+$/;
// The pomodoro-timer plugin's count, `[🍅:: done/estimated]` or `[🍅:: done]`.
const pomodoro = /\[🍅::[ \t]*\d+([ \t]*\/[ \t]*\d+)?[ \t]*\]/gu;

function toDays(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  return new Date(time).getUTCDate() === day && month >= 1 && month <= 12 ? time / 86400000 : null;
}

function fromDays(days: number) {
  return new Date(days * 86400000).toISOString().slice(0, 10);
}

const ymd = (days: number) => {
  const value = new Date(days * 86400000);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth(), day: value.getUTCDate() };
};
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const dayOf = (year: number, month: number, day: number) => Date.UTC(year, month, day) / 86400000;

// The date in the local time zone, which is what "today" means to the user.
export function localDate(value: Date) {
  const pad = (number: number) => String(number).padStart(2, '0');
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
}

export function parseRule(text: string): Rule | null {
  const words = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const whenDone = / when done$/.test(words);
  const rule = whenDone ? words.slice(0, -' when done'.length) : words;
  const count = (value: string | undefined) => value === undefined ? 1 : Number(value);
  const make = (unit: Rule['unit'], interval: number, extra: Partial<Rule> = {}): Rule | null =>
    interval >= 1 && interval <= 1000 ? { unit, interval, weekdays: null, monthDay: null, whenDone, ...extra } : null;
  let match;
  if ((match = /^every (?:(\d+) )?days?$/.exec(rule))) return make('day', count(match[1]));
  if (rule === 'every weekday') return make('week', 1, { weekdays: [0, 1, 2, 3, 4] });
  if ((match = /^every (?:(\d+) )?weeks?(?: on (.+))?$/.exec(rule))) {
    if (match[2] === undefined) return make('week', count(match[1]));
    const days = match[2].split(/ *, *(?:and )?| and /).map(name => names.indexOf(name));
    if (days.some(day => day < 0)) return null;
    return make('week', count(match[1]), { weekdays: [...new Set(days)].sort((a, b) => a - b) });
  }
  if ((match = /^every (?:(\d+) )?months?(?: on the (\d+)(?:st|nd|rd|th))?$/.exec(rule))) {
    const day = match[2] === undefined ? null : Number(match[2]);
    if (day !== null && (day < 1 || day > 31)) return null;
    return make('month', count(match[1]), { monthDay: day });
  }
  if ((match = /^every (?:(\d+) )?years?$/.exec(rule))) return make('year', count(match[1]));
  return null;
}

// The first date of the rule after `reference`, a day number. Without a fixed day, a month or year
// later is the same day of the month, or the last day of a shorter month (Jan 31 → Feb 28, and
// Feb 29 → Feb 28 in a common year), as Tasks does. "every month on the 31st" skips shorter months.
function after(rule: Rule, reference: number) {
  const { year, month, day } = ymd(reference);
  if (rule.unit === 'day') return reference + rule.interval;
  if (rule.unit === 'week') {
    if (!rule.weekdays) return reference + 7 * rule.interval;
    // Weeks start on Monday and count from the week of the reference date.
    const monday = reference - (new Date(reference * 86400000).getUTCDay() + 6) % 7;
    for (let week = 0; ; week += rule.interval) {
      const next = rule.weekdays.map(weekday => monday + week * 7 + weekday).find(value => value > reference);
      if (next !== undefined) return next;
    }
  }
  if (rule.unit === 'month' && rule.monthDay !== null) {
    for (let months = 0; months <= 12 * rule.interval * 4; months += rule.interval) {
      const target = month + months, y = year + Math.floor(target / 12), m = target % 12;
      if (rule.monthDay <= daysIn(y, m) && dayOf(y, m, rule.monthDay) > reference) return dayOf(y, m, rule.monthDay);
    }
    return null;
  }
  const target = month + (rule.unit === 'month' ? rule.interval : 12 * rule.interval);
  const y = year + Math.floor(target / 12), m = target % 12;
  return dayOf(y, m, Math.min(day, daysIn(y, m)));
}

export function nextDate(ruleText: string, reference: string): string | null {
  const rule = parseRule(ruleText), days = toDays(reference);
  if (!rule || days === null) return null;
  const next = after(rule, days);
  return next === null ? null : fromDays(next);
}

export function ruleOf(title: string) {
  const match = recurrence.exec(title);
  return match ? match[1].trim() : null;
}

// Whether completing a task with this title creates a next occurrence.
export function recurs(title: string) {
  const rule = ruleOf(title);
  return rule !== null && parseRule(rule) !== null;
}

// The title of a completed task: `✅ today` at the end, before a block id.
export function completedTitle(title: string, today: string) {
  const base = title.replace(dropped[0], '');
  const link = blockLink.exec(base)?.[0] ?? '';
  return base.slice(0, base.length - link.length).trimEnd() + ' ✅ ' + today + link;
}

// The title of the occurrence after a task with this title, completed `today`, or null when it
// has no rule this module knows. Its dates keep their distance to the reference date (due, else
// scheduled, else start), which moves to the next date of the rule.
export function nextTitle(title: string, today: string): string | null {
  const ruleText = ruleOf(title);
  const rule = ruleText === null ? null : parseRule(ruleText);
  if (!rule || toDays(today) === null) return null;
  const dates = Object.fromEntries(Object.entries(dateFields).map(([name, regex]) => [name, toDays(regex.exec(title)?.[1] ?? '')]));
  const reference = dates.due ?? dates.scheduled ?? dates.start;
  let next = title;
  if (reference !== null) {
    const nextReference = after(rule, rule.whenDone ? toDays(today)! : reference);
    if (nextReference === null) return null;
    for (const [name, regex] of Object.entries(dateFields)) {
      const days = dates[name];
      if (days !== null) next = next.replace(regex, value => value.replace(/\d{4}-\d{2}-\d{2}/, fromDays(nextReference + days - reference)));
    }
  }
  for (const regex of dropped) next = next.replace(regex, '');
  return next.replace(blockLink, '').replace(pomodoro, (_, estimate: string | undefined) => '[🍅:: 0' + (estimate ?? '') + ']').trimEnd();
}
