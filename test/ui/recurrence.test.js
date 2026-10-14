import { describe, expect, it } from 'vitest';
import { setup } from './harness.js';

// 2026-10-15, a Thursday, in the local time zone.
const now = () => new Date(2026, 9, 15, 9, 30);
const water = 'water 🔁 every week 📅 2026-10-14 [🍅:: 2/3]';

describe('recurring tasks', () => {
  it('completing one with the status button adds the next occurrence above, and one undo removes it', async () => {
    const text = '- [/] ' + water + ' ^w1\n  note\n  - [ ] child\n- [ ] other\n';
    const { user, row, titleValues, saved } = await setup({ 'tasks.md': text }, { now });
    await user.click(row(water + ' ^w1').getByRole('button', { name: '進行中（クリックで完了）' }));
    expect(await saved()).toBe('- [ ] water 🔁 every week 📅 2026-10-21 [🍅:: 0/3]\n- [x] ' + water + ' ✅ 2026-10-15 ^w1\n  note\n  - [ ] child\n- [ ] other\n');
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual([water + ' ^w1', 'child', 'other']);
    expect(await saved()).toBe(text);
  });

  it('marking it not done again creates nothing', async () => {
    const text = '- [x] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-14\n';
    const { user, row, saved } = await setup({ 'tasks.md': text }, { now });
    await user.click(row('a 🔁 every day 📅 2026-10-14 ✅ 2026-10-14').getByRole('button', { name: '完了（クリックで未着手）' }));
    expect(await saved()).toBe('- [ ] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-14\n');
  });

  it('the /done command and a selection complete recurring tasks too', async () => {
    const { user, screen, title, row, saved } = await setup({ 'tasks.md': '- [ ] a 🔁 every day 📅 2026-10-14\n- [ ] b 🔁 every month on the 1st when done\n- [ ] c\n' }, { now });
    await user.click(row('a 🔁 every day 📅 2026-10-14').getByTitle('項目を選択／ドラッグして移動'));
    await user.keyboard('{Shift>}');
    await user.click(row('b 🔁 every month on the 1st when done').getByTitle('項目を選択／ドラッグして移動'));
    await user.keyboard('{/Shift}');
    await user.click(screen.getByRole('button', { name: '完了' }));
    expect(await saved()).toBe('- [ ] a 🔁 every day 📅 2026-10-15\n- [x] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-15\n'
      + '- [ ] b 🔁 every month on the 1st when done\n- [x] b 🔁 every month on the 1st when done ✅ 2026-10-15\n- [ ] c\n');
    await user.type(title('a 🔁 every day 📅 2026-10-15'), ' /done');
    await user.keyboard('{Enter}');
    expect((await saved()).split('\n').slice(0, 3)).toEqual(['- [ ] a 🔁 every day 📅 2026-10-16', '- [x] a 🔁 every day 📅 2026-10-15 ✅ 2026-10-15', '- [x] a 🔁 every day 📅 2026-10-14 ✅ 2026-10-15']);
  });

  it('completing the zoomed item keeps the view on it and its children', async () => {
    const { user, screen, row, titleValues, saved } = await setup({ 'tasks.md': '- [/] a 🔁 every day\n  - [ ] child\n' }, { now });
    await user.click(row('a 🔁 every day').getByTitle('この項目にズーム'));
    await user.click(screen.getByRole('button', { name: 'ズーム対象を完了にする' }));
    expect(await saved()).toBe('- [ ] a 🔁 every day\n- [x] a 🔁 every day ✅ 2026-10-15\n  - [ ] child\n');
    expect(screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }).value).toBe('a 🔁 every day ✅ 2026-10-15');
    expect(titleValues()).toEqual(['child']);
  });
});
