import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/dom';
import { openMarkdownLink } from '../../src/ui/links.ts';
import { messages } from '../../src/ui/messages.ts';
import { flush, setup } from './harness.js';

// Records the links the host is asked to open.
function recorder() {
  const opened = [];
  const openLink = async (link, event) => { opened.push({ ...link, modifier: event.metaKey || event.ctrlKey, button: event.button }); };
  return { opened, openLink };
}

// While a title is edited the textarea is on top; jsdom does not place the caret from the pointer,
// so the caret is put where the click lands.
async function clickAt(node, offset, modifiers) {
  node.focus();
  node.setSelectionRange(offset, offset);
  fireEvent.click(node, modifiers);
  await flush();
}

describe('links to files', () => {
  const text = '- [ ] read [plan](notes/my%20plan.md#Goals) now\n  see [data](<data/table one.csv>)\n';

  it('are links when the host can open them, and text otherwise', async () => {
    const { opened, openLink } = recorder();
    const { container } = await setup({ 'tasks.md': text }, { openLink });
    const links = [...container.querySelectorAll('.title-display a, .note-display a')];
    expect(links.map(link => [link.textContent, link.getAttribute('href'), link.dataset.file, link.dataset.subpath, link.target])).toEqual([
      ['plan', 'notes/my%20plan.md#Goals', 'notes/my plan.md', '#Goals', ''],
      ['data', 'data/table one.csv', 'data/table one.csv', '', ''],
    ]);
    expect(opened).toEqual([]);
  });

  it('stay text when the host cannot open them', async () => {
    const { container } = await setup({ 'tasks.md': '- [ ] read [plan](plan.md) and **bold**\n' });
    const display = container.querySelector('.title-display');
    expect(display.querySelector('a')).toBeNull();
    expect(display.textContent).toBe('read [plan](plan.md) and bold');
  });

  it('a click asks the host to open the link from the file containing it instead of editing', async () => {
    const { opened, openLink } = recorder();
    const { user, container } = await setup({ 'notes/tasks.md': text }, { initialFile: 'notes/tasks.md', openLink });
    await user.click(container.querySelector('.title-display a'));
    await user.click(container.querySelector('.note-display a'));
    expect(opened).toEqual([
      { path: 'notes/my plan.md', subpath: '#Goals', source: 'notes/tasks.md', modifier: false, button: 0 },
      { path: 'data/table one.csv', subpath: '', source: 'notes/tasks.md', modifier: false, button: 0 },
    ]);
    expect(container.querySelector('.is-editing')).toBeNull();
  });

  it('⌘/Ctrl-click and a middle click tell the host to open a new tab', async () => {
    const { opened, openLink } = recorder();
    const { user, container } = await setup({ 'tasks.md': text }, { openLink });
    const link = container.querySelector('.title-display a');
    await user.keyboard('{Meta>}');
    await user.click(link);
    await user.keyboard('{/Meta}');
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(opened.map(({ modifier, button }) => [modifier, button])).toEqual([[true, 0], [false, 1]]);
  });

  it('clicking the text outside a link still edits it', async () => {
    const { opened, openLink } = recorder();
    const { user, container, title } = await setup({ 'tasks.md': text }, { openLink });
    await user.click(within(container.querySelector('.title-display')).getByText(/read/));
    expect(document.activeElement).toBe(title('read [plan](notes/my%20plan.md#Goals) now'));
    expect(opened).toEqual([]);
  });

  it('while editing, ⌘/Ctrl-click on a link opens it and a plain click only moves the caret', async () => {
    const { opened, openLink } = recorder();
    const { screen, title } = await setup({ 'tasks.md': text }, { openLink });
    const field = title('read [plan](notes/my%20plan.md#Goals) now');
    await clickAt(field, 'read [pl'.length, {});
    expect(opened).toEqual([]);
    expect(document.activeElement).toBe(field);
    await clickAt(field, 'read [plan](no'.length, { metaKey: true });
    await clickAt(field, 're'.length, { ctrlKey: true });
    await clickAt(screen.getByRole('textbox', { name: '項目のノート' }), 'see [d'.length, { ctrlKey: true });
    expect(opened.map(link => link.path)).toEqual(['notes/my plan.md', 'data/table one.csv']);
  });

  it('a link in a heading opens on a click', async () => {
    const { opened, openLink } = recorder();
    const { container } = await setup({ 'tasks.md': '# See [plan](plan.md)\n\n- [ ] a\n' }, { openLink });
    fireEvent.click(container.querySelector('.heading-title a'));
    expect(opened.map(link => link.path)).toEqual(['plan.md']);
  });

  it('a link that cannot be opened shows the reason', async () => {
    const { user, screen, container } = await setup({ 'tasks.md': text }, { openLink: () => Promise.reject(new Error(messages.ja.link.missing)) });
    await user.click(container.querySelector('.title-display a'));
    await waitFor(() => expect(screen.getByText(messages.ja.link.missing)).toBeTruthy());
  });

  it('a link to a Markdown file switches the outliner to it, as choosing the file does', async () => {
    let env;
    env = await setup({
      'notes/tasks.md': '- [ ] read [plan](my%20plan.md)\n- [ ] [root](/README.md) [gone](gone.md)\n',
      'notes/my plan.md': '- [ ] goal\n',
      'README.md': '- [ ] top\n',
    }, { initialFile: 'notes/tasks.md', openLink: link => openMarkdownLink(link, env.adapter, env.app, messages.ja) });
    const { user, screen, container, titleValues } = env;
    const fileSelect = () => screen.getByRole('combobox', { name: '開くファイル' });
    await user.click(within(container.querySelector('.title-display')).getByRole('link', { name: 'plan' }));
    await waitFor(() => expect(titleValues()).toEqual(['goal']));
    expect(fileSelect().value).toBe('notes/my plan.md');
    await user.selectOptions(fileSelect(), 'notes/tasks.md');
    await waitFor(() => expect(titleValues()).toEqual(['read [plan](my%20plan.md)', '[root](/README.md) [gone](gone.md)']));
    await user.click(screen.getByRole('link', { name: 'gone' }));
    await waitFor(() => expect(screen.getByText(messages.ja.link.missing)).toBeTruthy());
    await user.click(screen.getByRole('link', { name: 'root' }));
    await waitFor(() => expect(titleValues()).toEqual(['top']));
  });
});
