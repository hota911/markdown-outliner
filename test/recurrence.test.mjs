import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.ts';
import { completedTitle, localDate, nextDate, nextTitle, parseRule } from '../src/recurrence.ts';

test('日・週の間隔で次の日付を求める', () => {
  assert.equal(nextDate('every day', '2026-10-14'), '2026-10-15');
  assert.equal(nextDate('every 3 days', '2026-12-30'), '2027-01-02');
  assert.equal(nextDate('every week', '2026-10-14'), '2026-10-21');
  assert.equal(nextDate('every 2 weeks', '2026-10-14'), '2026-10-28');
  assert.equal(nextDate('Every  Week', '2026-10-14'), '2026-10-21');
});

test('曜日指定と平日は基準日より後の最初の該当日になる', () => {
  // 2026-10-14 is a Wednesday.
  assert.equal(nextDate('every week on Monday', '2026-10-14'), '2026-10-19');
  assert.equal(nextDate('every week on Monday', '2026-10-19'), '2026-10-26');
  assert.equal(nextDate('every week on Monday, Friday', '2026-10-14'), '2026-10-16');
  assert.equal(nextDate('every week on Monday, Friday', '2026-10-16'), '2026-10-19');
  assert.equal(nextDate('every week on tuesday and thursday', '2026-10-15'), '2026-10-20');
  assert.equal(nextDate('every week on Sunday', '2026-10-18'), '2026-10-25');
  // Weeks start on Monday and are counted from the week of the reference date, as in rrule.
  assert.equal(nextDate('every 2 weeks on Monday', '2026-10-14'), '2026-10-26');
  assert.equal(nextDate('every 2 weeks on Friday', '2026-10-14'), '2026-10-16');
  assert.equal(nextDate('every weekday', '2026-10-14'), '2026-10-15');
  assert.equal(nextDate('every weekday', '2026-10-16'), '2026-10-19');
  assert.equal(nextDate('every weekday', '2026-10-17'), '2026-10-19');
});

test('月と年は短い月の末日に丸め、日付指定はその日がない月を飛ばす', () => {
  assert.equal(nextDate('every month', '2026-10-14'), '2026-11-14');
  assert.equal(nextDate('every month', '2026-12-15'), '2027-01-15');
  assert.equal(nextDate('every month', '2026-01-31'), '2026-02-28');
  assert.equal(nextDate('every month', '2028-01-31'), '2028-02-29');
  assert.equal(nextDate('every month', '2026-03-31'), '2026-04-30');
  assert.equal(nextDate('every 3 months', '2026-11-30'), '2027-02-28');
  assert.equal(nextDate('every 12 months', '2026-10-14'), '2027-10-14');
  assert.equal(nextDate('every month on the 15th', '2026-10-14'), '2026-10-15');
  assert.equal(nextDate('every month on the 15th', '2026-10-15'), '2026-11-15');
  assert.equal(nextDate('every month on the 1st', '2026-12-20'), '2027-01-01');
  assert.equal(nextDate('every month on the 31st', '2026-01-31'), '2026-03-31');
  assert.equal(nextDate('every 2 months on the 2nd', '2026-10-03'), '2026-12-02');
  assert.equal(nextDate('every year', '2026-10-14'), '2027-10-14');
  assert.equal(nextDate('every year', '2028-02-29'), '2029-02-28');
  assert.equal(nextDate('every 4 years', '2028-02-29'), '2032-02-29');
  assert.equal(nextDate('every 2 years', '2027-02-28'), '2029-02-28');
});

test('知らない規則は null になる', () => {
  for (const rule of ['every blue moon', 'every 0 days', 'every week on Funday', 'every month on the 32nd', 'every month on the last', 'weekly', '']) {
    assert.equal(parseRule(rule), null, rule);
  }
  assert.deepEqual(parseRule('every 2 weeks on Friday, Monday when done'), { unit: 'week', interval: 2, weekdays: [0, 4], monthDay: null, whenDone: true });
});

test('次の回は期日・予定日・開始日を基準日からの差を保って動かし、一回限りの欄を落とす', () => {
  const title = 'Pay rent #home 🔁 every month 🛫 2026-01-25 ⏳ 2026-01-29 📅 2026-01-31 ➕ 2026-01-01 🆔 rent ⛔ a1,b2 [🍅:: 2/3] ✅ 2026-01-30';
  assert.equal(nextTitle(title + ' ^abc-1', '2026-02-02'), 'Pay rent #home 🔁 every month 🛫 2026-02-22 ⏳ 2026-02-26 📅 2026-02-28 [🍅:: 0/3]');
  // Without a due date, the scheduled date is the reference; without either, the start date.
  assert.equal(nextTitle('a 🔁 every week ⏳ 2026-10-14 🛫 2026-10-10', '2026-10-30'), 'a 🔁 every week ⏳ 2026-10-21 🛫 2026-10-17');
  assert.equal(nextTitle('a 🔁 every day 🛫 2026-10-14', '2026-10-30'), 'a 🔁 every day 🛫 2026-10-15');
  assert.equal(nextTitle('a [🍅:: 3] 🔁 every day', '2026-10-30'), 'a [🍅:: 0] 🔁 every day');
  assert.equal(nextTitle('a 🔁 every day', '2026-10-30'), 'a 🔁 every day');
  assert.equal(nextTitle('a 🔁 every fortnight 📅 2026-10-14', '2026-10-30'), null);
  assert.equal(nextTitle('a 📅 2026-10-14', '2026-10-30'), null);
});

test('when done は完了した日から数える', () => {
  assert.equal(nextTitle('a 🔁 every week when done ⏳ 2026-09-29 📅 2026-10-01', '2026-10-14'), 'a 🔁 every week when done ⏳ 2026-10-19 📅 2026-10-21');
  assert.equal(nextTitle('a 🔁 every month on the 1st when done 📅 2026-08-01', '2026-10-14'), 'a 🔁 every month on the 1st when done 📅 2026-11-01');
});

test('完了日はブロック ID の前に付け、前の完了日を置き換える', () => {
  assert.equal(completedTitle('a 🔁 every day ^abc', '2026-10-14'), 'a 🔁 every day ✅ 2026-10-14 ^abc');
  assert.equal(completedTitle('a ✅ 2026-01-01 🔁 every day', '2026-10-14'), 'a 🔁 every day ✅ 2026-10-14');
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('繰り返すタスクを完了すると次の回を同じ字下げで上に足し、子とノートは完了した方に残る', () => {
  const text = '- parent\r\n  - [/] water 🔁 every 2 days 📅 2026-10-14 ^w1\r\n    note\r\n    - [ ] child\r\n- next\r\n';
  assert.deepEqual(core.updateStatus(text, 1, 'done', '2026-10-15'), {
    text: '- parent\r\n  - [ ] water 🔁 every 2 days 📅 2026-10-16\r\n  - [x] water 🔁 every 2 days 📅 2026-10-14 ✅ 2026-10-15 ^w1\r\n    note\r\n    - [ ] child\r\n- next\r\n',
    line: 2, inserted: [1],
  });
});

test('完了済み・未完了への変更、知らない規則、箇条書きでは次の回を作らない', () => {
  const done = '- [x] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-14\n';
  assert.deepEqual(core.updateStatus(done, 0, 'todo', '2026-10-15'), { text: '- [ ] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-14\n', line: 0 });
  assert.deepEqual(core.updateStatus(done, 0, 'done', '2026-10-15'), { text: done, line: 0 });
  assert.deepEqual(core.updateStatus('- [ ] a 🔁 every blue moon\n', 0, 'done', '2026-10-15'), { text: '- [x] a 🔁 every blue moon\n', line: 0 });
  assert.deepEqual(core.updateStatus('- [ ] a 🔁 every day\n', 0, 'in-progress', '2026-10-15'), { text: '- [/] a 🔁 every day\n', line: 0 });
  assert.deepEqual(core.updateStatus('- a 🔁 every day\n', 0, 'done', '2026-10-15'), { text: '- [x] a 🔁 every day\n', line: 0 });
});
