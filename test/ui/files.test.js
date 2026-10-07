import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { flush, setup } from './harness.js';

describe('extract to file', () => {
  it('moves the item with its children into a new file and embeds it', async () => {
    const { user, screen, row, adapter } = await setup({
      'notes/tasks.md': '- [ ] Plan trip #travel\n  - [ ] book hotel\n- [ ] other\n',
      'notes/Plan trip.md': '- [ ] existing\n',
    }, { initialFile: 'notes/tasks.md' });
    await user.click(row('Plan trip #travel').getByRole('button', { name: 'ファイルにする' }));
    await waitFor(() => expect(screen.getByText('Plan trip 2.md を作成しました。Undo の履歴は消去しました。')).toBeTruthy());
    expect(adapter.files.get('notes/Plan trip 2.md')).toBe('- [ ] Plan trip #travel\n  - [ ] book hotel\n');
    expect(adapter.files.get('notes/tasks.md')).toBe('- ![[Plan trip 2.md]]\n- [ ] other\n');
    expect(screen.getByText('Plan trip 2.md', { selector: '.embed-title' })).toBeTruthy();
  });

  it('explains that a new file cannot be made when the adapter cannot create files', async () => {
    const { user, screen, row, adapter } = await setup({ 'tasks.md': '- [ ] a\n' }, { canCreate: false });
    await user.click(row('a').getByRole('button', { name: 'ファイルにする' }));
    expect(screen.getByText('ファイルを指定して開いたときは新しいファイルを作れません。')).toBeTruthy();
    expect([...adapter.files.keys()]).toEqual(['tasks.md']);
  });
});

describe('rename an embedded file', () => {
  const nameInput = (screen, embed) => screen.queryByRole('textbox', { name: embed + ' の新しいファイル名（.md を除く）' });
  const startRename = async ({ user, screen }, embed = 'work.md') => {
    await user.click(screen.getByRole('button', { name: '名前を変更' }));
    return nameInput(screen, embed);
  };

  it('renames the file within its folder and points the embed at the new name', async () => {
    const env = await setup({
      'notes/tasks.md': '- [ ] host\n- ![[sub/work.md]]\n',
      'notes/sub/work.md': '- [ ] job\n',
    }, { initialFile: 'notes/tasks.md' });
    const input = await startRename(env, 'sub/work.md');
    expect(input.value).toBe('work');
    // The heading itself becomes the field, with the folder and .md kept as text around it.
    expect(input.closest('.embed-title').textContent).toBe('sub/.md');
    await env.user.clear(input);
    await env.user.type(input, 'done jobs{Enter}');
    await waitFor(() => expect(env.screen.getByText('done jobs.md に名前を変更しました。Undo の履歴は消去しました。')).toBeTruthy());
    expect([...env.adapter.files.keys()].sort()).toEqual(['notes/sub/done jobs.md', 'notes/tasks.md']);
    expect(env.adapter.files.get('notes/sub/done jobs.md')).toBe('- [ ] job\n');
    expect(env.adapter.files.get('notes/tasks.md')).toBe('- [ ] host\n- ![[sub/done jobs.md]]\n');
    // The embedded outline is still shown and edits save to the new file.
    await env.user.type(env.title('job'), ' moved');
    expect(await env.saved('notes/sub/done jobs.md')).toBe('- [ ] job moved\n');
    expect(env.screen.getByRole('combobox', { name: '開くファイル' }).textContent).toContain('notes/sub/done jobs.md');
  });

  it('keeps the embed path when the host already rewrote the link', async () => {
    const env = await setup({
      'tasks.md': '- ![[work.md]]\n',
      'other.md': '- ![[work.md]]\n',
      'work.md': '- [ ] job\n',
    }, { rewriteLinks: true });
    await env.user.type(await startRename(env), '{Control>}a{/Control}jobs{Enter}');
    await waitFor(() => expect(env.adapter.files.get('tasks.md')).toBe('- ![[jobs.md]]\n'));
    // Other files are left to the host; this mock rewrites them as Obsidian does.
    expect(env.adapter.files.get('other.md')).toBe('- ![[jobs]]\n');
    expect(env.title('job')).toBeTruthy();
  });

  it('remembers the new name as the last file when the renamed file is open', async () => {
    const savePreferences = async () => {};
    const preferences = { bookmarks: [{ id: '1', kind: 'file', file: 'work.md', status: 'all', tags: [] }], lastFile: 'tasks.md' };
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' }, { preferences, savePreferences });
    await env.user.type(await startRename(env), '{Control>}a{/Control}jobs{Enter}');
    await waitFor(() => expect(env.adapter.files.has('jobs.md')).toBe(true));
    expect(preferences.bookmarks[0].file).toBe('jobs.md');
    await env.user.selectOptions(env.screen.getByRole('combobox', { name: '開くファイル' }), 'jobs.md');
    await waitFor(() => expect(preferences.lastFile).toBe('jobs.md'));
  });

  it('reports an existing target and changes nothing', async () => {
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n', 'other.md': 'keep\n' });
    await env.user.type(await startRename(env), '{Control>}a{/Control}other{Enter}');
    await waitFor(() => expect(env.screen.getByText('ファイル名を変更できませんでした: すでにあります: other.md')).toBeTruthy());
    expect(Object.fromEntries(env.adapter.files)).toEqual({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n', 'other.md': 'keep\n' });
  });

  it.each(['a/b', '.hidden', 'x:y', '   '])('rejects the invalid name %j without calling the host', async name => {
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
    await env.user.type(await startRename(env), '{Control>}a{/Control}' + name + '{Enter}');
    expect(env.screen.getByText('ファイル名は空にできず、先頭の「.」と \\ / : * ? " < > | # ^ [ ] は使えません。')).toBeTruthy();
    expect(Object.fromEntries(env.adapter.files)).toEqual({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
  });

  it('cancels with Escape and leaves the files as they are', async () => {
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
    await env.user.type(await startRename(env), '{Control>}a{/Control}jobs{Escape}');
    await flush();
    expect(nameInput(env.screen, 'work.md')).toBeNull();
    expect(env.screen.getByText('work.md', { selector: '.embed-title' })).toBeTruthy();
    expect(Object.fromEntries(env.adapter.files)).toEqual({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
  });

  // Simulates another editor changing the embedding file while the host renames.
  const changeDuringRename = (adapter, path, text) => {
    const rename = adapter.rename;
    adapter.rename = async (from, to) => {
      await rename(from, to);
      adapter.externalWrite(path, text);
    };
  };

  it('updates the embed line that moved while the file was renamed', async () => {
    const env = await setup({ 'tasks.md': '- ![[a.md]]\n- ![[work.md]]\n', 'a.md': '- [ ] a\n', 'work.md': '- [ ] job\n' });
    await env.user.click(env.screen.getAllByRole('button', { name: '名前を変更' })[1]);
    const input = nameInput(env.screen, 'work.md');
    changeDuringRename(env.adapter, 'tasks.md', '- [ ] new\n- ![[a.md]]\n- ![[work.md]]\n');
    await env.user.type(input, '{Control>}a{/Control}jobs{Enter}');
    await waitFor(() => expect(env.screen.getByText('jobs.md に名前を変更しました。Undo の履歴は消去しました。')).toBeTruthy());
    expect(await env.saved('tasks.md')).toBe('- [ ] new\n- ![[a.md]]\n- ![[jobs.md]]\n');
    expect(env.adapter.files.get('a.md')).toBe('- [ ] a\n');
  });

  it.each([
    ['no line', '- [ ] replaced\n'],
    ['two lines', '- [ ] new\n- ![[work.md]]\n- [ ] other\n  - ![[work.md]]\n'],
  ])('leaves the text unchanged when %s of the changed file embed the old name', async (_, external) => {
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
    const input = await startRename(env);
    changeDuringRename(env.adapter, 'tasks.md', external);
    await env.user.type(input, '{Control>}a{/Control}jobs{Enter}');
    await waitFor(() => expect(env.screen.getByText('jobs.md に名前を変更しましたが、リンクを更新できませんでした。元の名前の埋め込みが1つに定まらないため、本文は変更していません。')).toBeTruthy());
    await flush();
    expect(env.adapter.files.get('tasks.md')).toBe(external);
    expect(env.adapter.files.has('jobs.md')).toBe(true);
  });

  it('shows another loaded file that still embeds the old name as missing', async () => {
    const env = await setup({ 'tasks.md': '- ![[work.md]]\n', 'other.md': '- [ ] keep\n- ![[work.md]]\n', 'work.md': '- [ ] job\n' });
    const files = env.screen.getByRole('combobox', { name: '開くファイル' });
    await env.user.selectOptions(files, 'other.md');
    await env.user.selectOptions(files, 'tasks.md');
    await env.user.type(await startRename(env), '{Control>}a{/Control}jobs{Enter}');
    await waitFor(() => expect(env.adapter.files.get('tasks.md')).toBe('- ![[jobs.md]]\n'));
    await env.user.selectOptions(files, 'other.md');
    await waitFor(() => expect(env.screen.getByText('ファイルを開けません。保存先とファイル名を確認してください。')).toBeTruthy());
    expect(env.title('keep')).toBeTruthy();
    expect(env.adapter.files.get('other.md')).toBe('- [ ] keep\n- ![[work.md]]\n');
  });

  it('offers no rename when the host cannot rename files', async () => {
    const { screen } = await setup({ 'tasks.md': '- ![[work.md]]\n', 'work.md': '- [ ] job\n' }, { canCreate: false });
    expect(screen.queryByRole('button', { name: '名前を変更' })).toBeNull();
  });
});

describe('embeds', () => {
  it('edits an embedded file in place and saves it to that file', async () => {
    const { user, title, saved, adapter } = await setup({
      'tasks.md': '- ![[sub/work.md]]\n',
      'sub/work.md': '- [ ] embedded\n',
    });
    await user.type(title('embedded'), ' task');
    expect(await saved('sub/work.md')).toBe('- [ ] embedded task\n');
    expect(adapter.files.get('tasks.md')).toBe('- ![[sub/work.md]]\n');
  });

  it('edits the zoom title and note of the file opened after switching to an already loaded file', async () => {
    const { user, screen, title, saved, adapter } = await setup({
      'tasks.md': '- [ ] host\n- ![[work.md]]\n',
      'work.md': '- [ ] job\n',
    });
    await user.selectOptions(screen.getByRole('combobox', { name: '開くファイル' }), 'work.md');
    await user.click(title('job').closest('.outline-item').querySelector('[title="この項目にズーム"]'));
    await user.type(screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }), ' title');
    await user.click(screen.getByRole('button', { name: 'ノート' }));
    await user.type(screen.getByRole('textbox', { name: 'ズーム対象のノート' }), 'memo');
    const work = await saved('work.md');
    expect(adapter.files.get('tasks.md')).toBe('- [ ] host\n- ![[work.md]]\n');
    expect(work).toBe('- [ ] job title\n  memo\n');
  });

  it('edits the zoom title and note of an embedded item in its own file', async () => {
    const { user, screen, title, saved, adapter } = await setup({
      'tasks.md': '- [ ] host\n- ![[work.md]]\n',
      'work.md': '- [ ] job\n',
    });
    await user.click(title('job').closest('.outline-item').querySelector('[title="この項目にズーム"]'));
    await user.type(screen.getByRole('textbox', { name: 'ズーム対象のタイトル' }), ' title');
    await user.click(screen.getByRole('button', { name: 'ノート' }));
    await user.type(screen.getByRole('textbox', { name: 'ズーム対象のノート' }), 'memo');
    const work = await saved('work.md');
    expect(adapter.files.get('tasks.md')).toBe('- [ ] host\n- ![[work.md]]\n');
    expect(work).toBe('- [ ] job title\n  memo\n');
  });

  it('shows a notice for a circular embed', async () => {
    const { screen } = await setup({ 'tasks.md': '- ![[tasks.md]]\n' });
    expect(screen.getByText('このファイルはすでに埋め込まれています。循環する埋め込みは表示できません。')).toBeTruthy();
  });
});

describe('undo and redo', () => {
  it('undoes and redoes a structural edit with the toolbar buttons', async () => {
    const { user, screen, title, titleValues, saved } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.click(title('a'));
    await user.keyboard('{Enter}b');
    expect(titleValues()).toEqual(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(titleValues()).toEqual(['a', '']);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(titleValues()).toEqual(['a']);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(titleValues()).toEqual(['a', '']);
    expect(await saved()).toBe('- [ ] a\n- [ ] \n');
  });

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', async () => {
    const { user, title, titleValues } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('b'));
    await user.keyboard('{Tab}');
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual(['a', 'b']);
    expect(title('b').closest('.outline-item').style.getPropertyValue('--depth')).toBe('0');
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(title('b').closest('.outline-item').style.getPropertyValue('--depth')).toBe('1');
  });

  it('undoes twice in a row and keeps focus on the edited item', async () => {
    const { user, title, titleValues } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.click(title('b'));
    await user.keyboard('{Tab}');
    await user.keyboard('{Enter}');
    expect(titleValues()).toEqual(['a', 'b', '']);
    await user.keyboard('{Control>}z{/Control}');
    expect(titleValues()).toEqual(['a', 'b']);
    expect(title('b').closest('.outline-item').style.getPropertyValue('--depth')).toBe('1');
    expect(document.activeElement).toBe(title('b'));
    await user.keyboard('{Control>}z{/Control}');
    expect(title('b').closest('.outline-item').style.getPropertyValue('--depth')).toBe('0');
    expect(document.activeElement).toBe(title('b'));
  });
});

describe('external changes and conflicts', () => {
  it('merges an external change to other lines when saving, and typing continues in the same item', async () => {
    const { user, screen, title, titleValues, adapter, saved } = await setup({ 'tasks.md': '- [ ] top\n- [ ] alpha\n' });
    await user.type(title('alpha'), 'X');
    adapter.externalWrite('tasks.md', '- [ ] top theirs\n- [ ] inserted\n- [ ] alpha\n');
    await waitFor(() => expect(adapter.files.get('tasks.md')).toBe('- [ ] top theirs\n- [ ] inserted\n- [ ] alphaX\n'), { timeout: 4000 });
    expect(screen.getByRole('status').textContent).toBe('tasks.md に外部の変更を取り込みました。Undo の履歴は消去しました。');
    expect(titleValues()).toEqual(['top theirs', 'inserted', 'alphaX']);
    expect(document.activeElement).toBe(title('alphaX'));
    expect(title('alphaX').selectionStart).toBe(6);
    await user.keyboard('!');
    expect(await saved()).toBe('- [ ] top theirs\n- [ ] inserted\n- [ ] alphaX!\n');
  });

  it('merges an external change into unsaved input when the tab is shown again', async () => {
    const { user, title, titleValues, adapter, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n' });
    await user.type(title('a'), '1');
    adapter.externalWrite('tasks.md', '- [ ] a\n- [ ] b2\n');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(titleValues()).toEqual(['a1', 'b2']));
    expect(document.activeElement).toBe(title('a1'));
    expect(await saved()).toBe('- [ ] a1\n- [ ] b2\n');
  });

  it('merges again when the file changes once more between the merge and the save', async () => {
    const { user, screen, title, adapter } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' });
    // Another editor writes again right after the merge read the file.
    const read = adapter.read;
    let writes = 0;
    adapter.read = async path => {
      const result = await read(path);
      if (writes++ === 0) adapter.externalWrite('tasks.md', '- [ ] a\n- [ ] b2\n- [ ] c3\n');
      return result;
    };
    await user.type(title('a'), '1');
    adapter.externalWrite('tasks.md', '- [ ] a\n- [ ] b2\n- [ ] c\n');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(adapter.files.get('tasks.md')).toBe('- [ ] a1\n- [ ] b2\n- [ ] c3\n'));
    expect(screen.queryByText(/保存競合/)).toBeNull();
  });

  it('shows the lines both sides changed, and keeps the other changes whichever side is chosen', async () => {
    const { user, screen, title, container, adapter, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' });
    await user.type(title('a'), 'b');
    await user.type(title('c'), ' mine');
    adapter.externalWrite('tasks.md', '- [ ] a theirs\n- [ ] b theirs\n- [ ] c\n');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByText('tasks.md は外部でも変更され、1 か所が入力内容と競合しています。競合箇所にどちらを使うか選んでください。ほかの行の変更は両方とも残します。')).toBeTruthy());
    expect([...container.querySelectorAll('.conflict-hunk pre')].map(side => side.textContent)).toEqual(['- [ ] ab', '- [ ] a theirs']);
    expect(screen.getByRole('textbox', { name: 'tasks.md の保存前の入力内容' }).value).toBe('- [ ] ab\n- [ ] b\n- [ ] c mine\n');
    expect(screen.getByText(/保存競合 1 ファイル/)).toBeTruthy();
    expect(adapter.files.get('tasks.md')).toBe('- [ ] a theirs\n- [ ] b theirs\n- [ ] c\n');
    await user.click(screen.getByRole('button', { name: '外部の内容を使う' }));
    expect(screen.queryByText(/保存競合/)).toBeNull();
    expect(await saved()).toBe('- [ ] a theirs\n- [ ] b theirs\n- [ ] c mine\n');
  });

  it('"入力内容を使う" keeps your lines where both sides changed them', async () => {
    const { user, screen, title, adapter, saved } = await setup({ 'tasks.md': '- [ ] a\n- [ ] b\n- [ ] c\n' });
    await user.type(title('a'), 'b');
    adapter.externalWrite('tasks.md', '- [ ] a theirs\n- [ ] b\n- [ ] c\n- [ ] d theirs\n');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: '入力内容を使う' }));
    expect(await saved()).toBe('- [ ] ab\n- [ ] b\n- [ ] c\n- [ ] d theirs\n');
  });

  it('keeps the input with only the copy options when saving fails for another reason', async () => {
    const { user, screen, title, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    adapter.save = async () => { throw new Error('ディスクがいっぱいです。'); };
    await user.type(title('a'), 'b');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByText('tasks.md に外部の変更があります。入力内容を残しています。必要ならコピーしてから外部の内容を開いてください。')).toBeTruthy());
    expect(screen.getByRole('textbox', { name: 'tasks.md の保存前の入力内容' }).value).toBe('- [ ] ab\n');
    expect(screen.queryByRole('button', { name: '入力内容を使う' })).toBeNull();
  });

  it('"外部の内容を開く" switches to the external content, and Undo brings the input back', async () => {
    const { user, screen, title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.type(title('a'), 'b');
    adapter.externalWrite('tasks.md', '- [ ] changed elsewhere\n');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: '外部の内容を開く' }));
    await waitFor(() => expect(titleValues()).toEqual(['changed elsewhere']));
    expect(screen.queryByRole('textbox', { name: 'tasks.md の保存前の入力内容' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(titleValues()).toEqual(['ab']);
  });

  it('shows an external change to an unedited file after leaving the field', async () => {
    const { user, title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.click(title('a'));
    adapter.externalWrite('tasks.md', '- [ ] from agent\n');
    title('a').blur();
    await flush();
    expect(titleValues()).toEqual(['from agent']);
  });

  it('says an external change waits while a field has focus, and shows it on the same item when the window gets focus', async () => {
    const { user, container, title, titleValues, adapter } = await setup({ 'tasks.md': '- [ ] top\n- [ ] alpha\n' });
    await user.click(title('alpha'));
    title('alpha').setSelectionRange(2, 2);
    adapter.externalWrite('tasks.md', '- [ ] top\n- [ ] inserted\n- [ ] alpha\n');
    await waitFor(() => expect(container.querySelector('.save-state').textContent).toBe('外部の変更あり（入力欄を離れると反映）'), { timeout: 4000 });
    expect(titleValues()).toEqual(['top', 'alpha']);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(titleValues()).toEqual(['top', 'inserted', 'alpha']));
    expect(document.activeElement).toBe(title('alpha'));
    expect(title('alpha').selectionStart).toBe(2);
    expect(container.querySelector('.save-state').textContent).toBe('保存済み');
  });

  it('shows an external change when the browser tab is shown again, and typing continues in the same item', async () => {
    const { user, title, titleValues, adapter, saved } = await setup({ 'tasks.md': '- [ ] top\n- [ ] alpha\n' });
    await user.click(title('alpha'));
    adapter.externalWrite('tasks.md', '- [ ] inserted\n- [ ] top\n- [ ] alpha\n');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(titleValues()).toEqual(['inserted', 'top', 'alpha']));
    await user.keyboard('!');
    expect(await saved()).toBe('- [ ] inserted\n- [ ] top\n- [ ] alpha!\n');
  });

  it('keeps unsaved input as a conflict instead of applying the external change when the tab is shown again', async () => {
    const { user, screen, title, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    await user.type(title('a'), 'b');
    adapter.externalWrite('tasks.md', '- [ ] changed elsewhere\n');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(screen.getByText(/保存競合 1 ファイル/)).toBeTruthy());
    expect(title('ab')).toBeTruthy();
  });

  it('picks up external changes periodically', async () => {
    const { titleValues, adapter } = await setup({ 'tasks.md': '- [ ] a\n' });
    adapter.externalWrite('tasks.md', '- [ ] polled\n');
    await waitFor(() => expect(titleValues()).toEqual(['polled']), { timeout: 4000 });
  });
});

describe('initial file', () => {
  const files = { 'a.md': '- [ ] in a\n', 'b.md': '- [ ] in b\n' };
  const fileSelect = screen => screen.getByRole('combobox', { name: '開くファイル' });
  const options = screen => [...fileSelect(screen).options].map(option => option.value);

  it('opens the first listed file when no file is given, and lists only existing files', async () => {
    const { screen, titleValues } = await setup(files, { initialFile: null });
    expect(titleValues()).toEqual(['in a']);
    expect(fileSelect(screen).value).toBe('a.md');
    expect(options(screen)).toEqual(['a.md', 'b.md']);
  });

  it('reopens the last file shown when it still exists', async () => {
    const stored = [];
    const first = await setup(files, { initialFile: null, savePreferences: async value => { stored.push(value); } });
    await first.user.selectOptions(fileSelect(first.screen), 'b.md');
    await waitFor(() => expect(stored.at(-1)).toEqual({ bookmarks: [], lastFile: 'b.md' }));

    const { titleValues } = await setup(files, { initialFile: null, preferences: stored.at(-1) });
    expect(titleValues()).toEqual(['in b']);
  });

  it('opens the first listed file when the last file shown no longer exists', async () => {
    const { titleValues } = await setup(files, { initialFile: null, preferences: { bookmarks: [], lastFile: 'deleted.md' } });
    expect(titleValues()).toEqual(['in a']);
  });

  it('opens the file given by the host even when another file was shown last', async () => {
    const { titleValues } = await setup(files, { initialFile: 'b.md', preferences: { bookmarks: [], lastFile: 'a.md' } });
    expect(titleValues()).toEqual(['in b']);
  });

  it('shows that there is nothing to open when the folder has no Markdown files', async () => {
    const { screen, titles } = await setup({}, { initialFile: null });
    expect(screen.getByText('このフォルダには Markdown ファイルがありません。')).toBeTruthy();
    expect(titles()).toEqual([]);
    expect(options(screen)).toEqual([]);
  });
});
