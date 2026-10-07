import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { CoreError } from '../../src/core.ts';
import { errorText, languageOf, messages, serverErrorText } from '../../src/ui/messages.ts';
import { setup } from './harness.js';

// Kana, kanji and Japanese punctuation such as 、。「」.
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\u3000-\u303f]/u;

const files = {
  'tasks.md': '- [ ] Plan trip #travel\n  Pack early\n  - [/] Book hotel\n- [x] Done item\n- [ ] #later\n- ![[work.md]]\n- Bullet\n',
  'work.md': '- [ ] Embedded task\n',
};
const preferences = () => ({ bookmarks: [
  { id: 'file', kind: 'file', file: 'tasks.md', status: 'all', tags: [] },
  { id: 'search', kind: 'search', file: 'tasks.md', status: 'in-progress', tags: ['travel'], searchText: 'hotel' },
] });

// Everything a user can read or hear: rendered text plus titles, labels and placeholders.
function visibleText(container) {
  const attributes = [...container.querySelectorAll('[title], [aria-label], [placeholder]')]
    .flatMap(node => ['title', 'aria-label', 'placeholder'].map(name => node.getAttribute(name)).filter(Boolean));
  return [container.textContent, ...attributes].join('\n');
}

async function selectTwo({ user, row }, first, second, handle) {
  await user.click(row(first).getByTitle(handle));
  await user.keyboard('{Shift>}');
  await user.click(row(second).getByTitle(handle));
  await user.keyboard('{/Shift}');
}

describe('English UI', () => {
  it('renders every label, status, toast and help text in English', async () => {
    const outliner = await setup(files, { language: 'en', preferences: preferences() });
    const { screen, row, user, container, adapter } = outliner;
    await waitFor(() => expect(screen.getByText('Open this file')).toBeTruthy());

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Not done' })).toBeTruthy();
    expect(row('Plan trip #travel').getByRole('button', { name: 'Not started (click for in progress)' })).toBeTruthy();
    expect(row('Book hotel').getByRole('button', { name: 'In progress (click for done)' })).toBeTruthy();
    expect(screen.getByText('In progress #travel "hotel" · tasks.md')).toBeTruthy();
    expect(container.querySelector('.save-state').textContent).toBe('Saved');
    expect(container.querySelector('.help').textContent).toBe(messages.en.help);

    // A title with nothing usable for a file name falls back to the English base name.
    await user.click(row('#later').getByRole('button', { name: 'Move to file' }));
    await waitFor(() => expect(screen.getByText('Created Task.md. The undo history was cleared.')).toBeTruthy());
    expect(adapter.files.get('Task.md')).toBe('- [ ] #later\n');

    await selectTwo(outliner, 'Plan trip #travel', 'Done item', 'Select, or drag to move');
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(screen.getByTitle('Mark the selected tasks as done')).toBeTruthy();

    expect(visibleText(container)).not.toMatch(japanese);
  });
});

describe('Japanese UI', () => {
  it('keeps the Japanese wording', async () => {
    const outliner = await setup(files, { language: 'ja', preferences: preferences() });
    const { screen, row, user, container, adapter } = outliner;
    await waitFor(() => expect(screen.getByText('このファイルを開く')).toBeTruthy());

    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '完了以外' })).toBeTruthy();
    expect(row('Plan trip #travel').getByRole('button', { name: '未着手（クリックで進行中）' })).toBeTruthy();
    expect(screen.getByText('進行中 #travel「hotel」 · tasks.md')).toBeTruthy();
    expect(container.querySelector('.save-state').textContent).toBe('保存済み');
    expect(container.querySelector('.help').textContent).toBe(
      '↑↓: カーソル移動 · Enter: 追加（本文の先頭では上に追加） · ⌘/Ctrl+Enter: 進行中→完了 · Tab / Shift+Tab: 階層 · Shift+Enter: タスク⇄ノート · ⠿: ドラッグ（挿入線の字下げで階層を表示） · Shift / ⌘クリック: 複数選択 · 先頭か空白の後の / と #: コマンドとタグ · #タグをクリック: 絞り込みに追加（編集中は⌘/Ctrlクリック）');

    await user.click(row('#later').getByRole('button', { name: 'ファイルにする' }));
    await waitFor(() => expect(screen.getByText('タスク.md を作成しました。Undo の履歴は消去しました。')).toBeTruthy());
    expect(adapter.files.get('タスク.md')).toBe('- [ ] #later\n');

    await selectTwo(outliner, 'Plan trip #travel', 'Done item', '項目を選択／ドラッグして移動');
    expect(screen.getByText('2 項目を選択')).toBeTruthy();
    expect(screen.getByTitle('選択したタスクを完了にする')).toBeTruthy();
  });
});

describe('messages', () => {
  it('chooses Japanese only for Japanese language tags', () => {
    expect(['ja', 'ja-JP', 'JA'].map(languageOf)).toEqual(['ja', 'ja', 'ja']);
    expect(['en', 'en-US', 'fr', 'zh-CN', 'jv', ''].map(languageOf)).toEqual(['en', 'en', 'en', 'en', 'en', 'en']);
  });

  it('translates edit refusals and server error codes', () => {
    expect(errorText(messages.en, new CoreError('reparentIntoSelf'))).toBe('Cannot move an item under itself or its descendants.');
    expect(errorText(messages.ja, new CoreError('reparentIntoSelf'))).toBe('自分自身や子孫の子には移動できません');
    expect(errorText(messages.en, new Error('Adapter text'))).toBe('Adapter text');
    expect(serverErrorText(messages.en, 'fileExists')).toBe('A file with the same name already exists.');
    expect(serverErrorText(messages.ja, 'fileExists')).toBe('同じ名前のファイルがすでにあります。');
    expect(serverErrorText(messages.en, 'unknown')).toBe('The operation failed.');
    expect(serverErrorText(messages.ja, undefined)).toBe('操作に失敗しました。');
  });

  it('has no Japanese anywhere in the English messages', () => {
    const texts = [];
    const collect = value => {
      if (typeof value === 'string') texts.push(value);
      else if (typeof value === 'function') texts.push(value('todo', 'done', 'x', 'y'));
      else Object.values(value).forEach(collect);
    };
    collect(messages.en);
    expect(texts.length).toBeGreaterThan(150);
    expect(texts.filter(text => japanese.test(text))).toEqual([]);
  });
});
