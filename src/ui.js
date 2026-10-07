(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OutlinerUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function mount(container, { core, adapter, drafts, initialFile = 'tasks.md', preferences = { bookmarks: [] }, savePreferences }) {
    const docs = drafts || new Map();
    let preferenceSave = Promise.resolve();
    let current = initialFile;
    let filter = 'all';
    let tags = '';
    let textSearch = '';
    let zoom = null;
    let active = null;
    let composing = false;
    let deferred = false;
    let destroyed = false;
    let polling = false;
    let rendering = false;
    let pressing = false;
    let message = '';
    let busy = false;
    let autoSave = true;
    let saveTimer;
    let toastTimer;
    let toastMessage = '';
    let toastNode;
    let selectedPath = null;
    let selectedLines = new Set();
    let selectionAnchor = null;
    let dragging = null;
    const renderedRows = new Map();
    const collapsed = new Set();
    const kept = new Map();
    const undo = [];
    const redo = [];
    // The height lives in styles.css; only the measured value is passed as a CSS variable.
    function fitTitle(node) {
      node.style.setProperty('--title-height', '28px');
      node.style.setProperty('--title-height', Math.max(28, node.scrollHeight) + 'px');
    }
    let titleWidth = 0;
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width === titleWidth) return;
      titleWidth = width;
      for (const node of container.querySelectorAll('.title-input')) fitTitle(node);
    }) : null;
    resizeObserver?.observe(container);

    function scheduleSave() {
      clearTimeout(saveTimer);
      if (!autoSave || destroyed) return;
      saveTimer = setTimeout(() => {
        if (busy || composing || polling) { scheduleSave(); return; }
        if ([...docs.values()].some(doc => doc.dirty && !doc.conflict)) saveAll(true);
      }, 800);
    }
    function clearSelection() {
      selectedPath = null;
      selectedLines.clear();
      selectionAnchor = null;
    }

    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const button = (text, title, fn, cls = '') => {
      const node = el('button', cls, text);
      node.type = 'button';
      node.title = title;
      node.addEventListener('click', fn);
      return node;
    };
    const statuses = [['todo', '未着手'], ['in-progress', '進行中'], ['done', '完了']];
    function clearToast() {
      clearTimeout(toastTimer);
      toastMessage = '';
      toastNode?.remove();
      toastNode = null;
    }
    function renderToast() {
      toastNode?.remove();
      if (!toastMessage) return;
      toastNode = el('div', 'toast');
      const text = el('span', '', toastMessage);
      text.setAttribute('role', 'status');
      toastNode.append(text, button('×', '通知を閉じる', clearToast, 'icon'));
      container.append(toastNode);
    }
    function showToast(text) {
      clearToast();
      toastMessage = text;
      renderToast();
      toastTimer = setTimeout(clearToast, 4500);
    }
    const statusSelect = (value, fn) => {
      const node = el('select');
      node.setAttribute('aria-label', '表示する状態');
      for (const [v, label] of [['all', 'すべて'], ['not-done', '完了以外'], ...statuses]) {
        const option = el('option', '', label);
        option.value = v;
        node.append(option);
      }
      node.value = value || 'todo';
      node.addEventListener('change', () => fn(node.value));
      return node;
    };
    const rowsFor = text => {
      const result = core.parse(text);
      return Array.isArray(result) ? result : result.rows;
    };
    const key = (path, line) => path + ':' + line;
    const tagList = () => tags.trim().split(/\s+/).filter(Boolean).map(t => t.replace(/^#/, ''));
    const searchValue = () => [textSearch.trim(), tagList().map(tag => '#' + tag).join(' ')].filter(Boolean).join(' ');
    function parseSearch(value) {
      const queryTags = [];
      const words = [];
      for (const word of value.trim().split(/\s+/).filter(Boolean)) {
        if (/^#[^#\s]+$/.test(word)) queryTags.push(word.slice(1));
        else words.push(word);
      }
      tags = queryTags.join(' ');
      textSearch = words.join(' ');
    }
    const keepFor = path => [...(kept.get(path) || []), ...(active && active.path === path ? [active.line] : [])];
    function normalize(from, target) {
      if (typeof target !== 'string' || !target || /^(?:[/\\]|[a-zA-Z]:|[a-zA-Z]+:)/.test(target)) throw new Error('埋め込み先にはフォルダー内の相対パスを指定してください。');
      const parts = from.split('/').slice(0, -1);
      for (const part of target.replace(/\\/g, '/').split('/')) {
        if (part === '..') {
          if (!parts.length) throw new Error('埋め込み先がフォルダーの外にあります。');
          parts.pop();
        } else if (part && part !== '.') parts.push(part);
      }
      return parts.join('/');
    }
    async function load(path) {
      if (docs.has(path)) return docs.get(path);
      const result = await adapter.read(path);
      const doc = { text: result.text, baseRevision: result.revision, dirty: false, conflict: false };
      docs.set(path, doc);
      return doc;
    }
    async function loadEmbeds(path, chain = []) {
      if (chain.includes(path)) return;
      const doc = await load(path);
      for (const row of rowsFor(doc.text)) {
        if (row.kind !== 'embed') continue;
        try { await loadEmbeds(normalize(path, row.embed), [...chain, path]); }
        catch (_) { /* A visible notice is rendered at this embed. */ }
      }
    }
    const capture = () => new Map([...docs].map(([path, doc]) => [path, doc.text]));
    function remember() {
      undo.push(capture());
      if (undo.length > 100) undo.shift();
      redo.length = 0;
    }
    function applySnapshot(snapshot) {
      for (const [path, text] of snapshot) {
        const doc = docs.get(path);
        if (doc && doc.text !== text) { doc.text = text; doc.dirty = true; }
      }
      kept.clear();
      active = null;
      clearSelection();
      scheduleSave();
      render();
    }
    function history(back) {
      const source = back ? undo : redo;
      if (!source.length) return;
      (back ? redo : undo).push(capture());
      applySnapshot(source.pop());
    }
    function completeActive() {
      if (composing || !active) return false;
      const { path, line, field } = active;
      const row = rowsFor(docs.get(path).text).find(row => row.line === line);
      if (!row) return false;
      if (row.status === 'in-progress') mutate(path, text => core.updateStatus(text, line, 'done'), field);
      return true;
    }
    function mutate(path, fn, focus) {
      const doc = docs.get(path);
      let result;
      try { result = fn(doc.text); }
      catch (error) { showToast(error.message); return; }
      message = '';
      if (result.text === doc.text) return;
      remember();
      const folded = rowsFor(doc.text).filter(row => collapsed.has(key(path, row.line)));
      doc.text = result.text;
      doc.dirty = true;
      clearSelection();
      scheduleSave();
      for (const id of [...collapsed]) if (id.startsWith(path + ':')) collapsed.delete(id);
      for (const row of rowsFor(doc.text)) if (folded.some(previous => previous.kind === row.kind && previous.title === row.title && previous.embed === row.embed)) collapsed.add(key(path, row.line));
      kept.clear();
      if (focus && result.line !== null) {
        kept.set(path, new Set([result.line]));
        active = { path, line: result.line, field: focus };
      } else active = null;
      if (zoom && zoom.path === path) {
        if (zoom.line === result.line || !rowsFor(doc.text).some(row => row.line === zoom.line)) zoom.line = result.line;
      }
      render();
    }
    function inputEdit(path, line, field, value) {
      const doc = docs.get(path);
      let result;
      try { result = field === 'note' ? core.updateNote(doc.text, line, value) : core.updateTitle(doc.text, line, value); }
      catch (error) {
        message = error.message;
        if (alertArea) { alertArea.replaceChildren(el('div', 'notice', message)); }
        return;
      }
      const delta = result.text.split('\n').length - doc.text.split('\n').length;
      if (delta) {
        for (const row of renderedRows.get(path) || []) {
          if (row.line > line) row.line += delta;
          if (row.end > line) row.end += delta;
          if (row.parentLine !== null && row.parentLine > line) row.parentLine += delta;
        }
        const existing = kept.get(path);
        if (existing) kept.set(path, new Set([...existing].map(value => value > line ? value + delta : value)));
        if (active && active.path === path && active.line > line) active.line += delta;
        if (zoom && zoom.path === path && zoom.line > line) zoom.line += delta;
        if (selectedPath === path) {
          selectedLines = new Set([...selectedLines].map(value => value > line ? value + delta : value));
          if (selectionAnchor > line) selectionAnchor += delta;
        }
        for (const id of [...collapsed]) {
          if (!id.startsWith(path + ':')) continue;
          const value = Number(id.slice(path.length + 1));
          if (value > line) { collapsed.delete(id); collapsed.add(key(path, value + delta)); }
        }
        for (const node of container.querySelectorAll('[data-field]')) {
          if (node.dataset.path === path && Number(node.dataset.line) > line) node.dataset.line = Number(node.dataset.line) + delta;
        }
      }
      doc.text = result.text;
      doc.dirty = true;
      scheduleSave();
      updateStatus();
    }
    const insertion = child => ({ child, status: filter === 'all' || filter === 'not-done' ? 'todo' : filter, tags: tagList() });
    function add(path, line, child, kind) {
      const source = rowsFor(docs.get(path).text).find(row => row.line === line);
      const nextKind = kind || (source?.kind === 'bullet' ? 'bullet' : 'task');
      mutate(path, text => core.insert(text, line, { ...insertion(child), kind: nextKind }), 'title');
    }
    function merge(path, row, backwards) {
      let column;
      mutate(path, text => {
        const result = core.merge(text, row.line, backwards ? 'previous' : 'next');
        column = result.column;
        return result;
      }, 'title');
      const focused = document.activeElement;
      if (column !== undefined && focused?.dataset.field === 'title') focused.setSelectionRange(column, column);
    }
    async function extractToFile(path, line) {
      const doc = docs.get(path);
      if (selectedLines.size > 1) { showToast('複数選択中はファイルにできません。選択を解除してください。'); return; }
      if (!adapter.create) { showToast('ファイルを指定して開いたときは新しいファイルを作れません。'); return; }
      if (busy || doc.conflict) { showToast('保存処理中または保存競合中はファイルにできません。'); return; }
      busy = true;
      updateStatus();
      const before = doc.text;
      const folder = path.split('/').slice(0, -1).join('/');
      let name, relative, result, created;
      try {
        const siblings = (await adapter.list()).filter(file => file.split('/').slice(0, -1).join('/') === folder).map(file => file.split('/').pop());
        const row = rowsFor(before).find(value => value.line === line);
        name = core.fileName(row.title, siblings);
        relative = folder ? folder + '/' + name : name;
        result = core.extractToFile(before, line, name);
        // The new file is created first so that a failure leaves the original untouched.
        created = await adapter.create(relative, result.extracted);
      } catch (error) {
        busy = false;
        updateStatus();
        showToast('ファイルにできませんでした: ' + error.message);
        return;
      }
      busy = false;
      updateStatus();
      if (doc.text !== before) {
        showToast(name + ' を作成しましたが、作成中に入力が変わったため元の項目は置き換えていません。');
        return;
      }
      docs.set(relative, { text: result.extracted, baseRevision: created.revision, dirty: false, conflict: false });
      if (!fileList.includes(relative)) fileList.push(relative);
      mutate(path, () => result, null);
      // Undo cannot remove the created file, so restoring older snapshots would duplicate the item.
      undo.length = 0;
      redo.length = 0;
      await saveAll();
      showToast(name + ' を作成しました。Undo の履歴は消去しました。');
    }
    function editControl(node, path, row, field) {
      let editRecorded = false;
      node.dataset.path = path;
      node.dataset.line = row.line;
      node.dataset.field = field;
      node.addEventListener('focus', () => {
        active = { path, line: row.line, field };
        const latest = rowsFor(docs.get(path).text).find(value => value.line === row.line);
        if (latest) node.value = field === 'note' ? latest.note : latest.title;
        if (field === 'title') fitTitle(node);
      });
      node.addEventListener('compositionstart', () => { composing = true; });
      node.addEventListener('compositionend', () => { composing = false; scheduleSave(); });
      node.addEventListener('input', () => {
        if (field === 'title' && /[\r\n]/.test(node.value)) {
          const position = node.selectionStart;
          const prefix = node.value.slice(0, position).replace(/[\r\n]+/g, ' ');
          node.value = node.value.replace(/[\r\n]+/g, ' ');
          node.setSelectionRange(prefix.length, prefix.length);
        }
        if (!editRecorded) { remember(); editRecorded = true; }
        inputEdit(path, row.line, field, node.value);
        if (field === 'note') node.rows = Math.max(1, Math.min(8, node.value.split('\n').length));
        else fitTitle(node);
      });
      node.addEventListener('blur', () => {
        if (rendering) return;
        active = null;
        composing = false;
        deferred = true;
        poll();
      });
      node.addEventListener('keydown', event => {
        if (event.isComposing || composing || event.keyCode === 229) return;
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          completeActive();
          return;
        }
        if (field === 'note') {
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            active = { path, line: row.line, field: 'title' };
            render();
          }
          return;
        }
        const collapsedSelection = node.selectionStart === node.selectionEnd;
        const atStart = event.key === 'Backspace' && node.selectionStart === 0;
        const atEnd = event.key === 'Delete' && node.selectionEnd === node.value.length;
        const zoomRoot = zoom?.path === path ? rowsFor(docs.get(path).text).find(value => value.line === zoom.line) : null;
        if (zoomRoot && row.line === zoomRoot.line) {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) { active = { path, line: row.line, field: 'note' }; render(); }
            else add(path, row.line, true);
            return;
          }
          if (event.key === 'Tab' || event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); return; }
          if (collapsedSelection && (atStart || atEnd)) return;
        }
        if (collapsedSelection && (atStart || atEnd) && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          if (zoomRoot) {
            const rows = rowsFor(docs.get(path).text);
            const neighbor = rows[rows.findIndex(value => value.line === row.line) + (atStart ? -1 : 1)];
            if (!neighbor || neighbor.line <= zoomRoot.line || neighbor.line >= zoomRoot.end) return;
          }
          merge(path, row, atStart);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (event.shiftKey) {
            active = { path, line: row.line, field: 'note' };
            render();
          } else add(path, row.line, false);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          if (zoomRoot && event.shiftKey && row.parentLine === zoomRoot.line) return;
          mutate(path, text => core[event.shiftKey ? 'outdent' : 'indent'](text, row.line), 'title');
        } else if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          mutate(path, text => core.move(text, row.line, event.key === 'ArrowUp' ? 'up' : 'down'), 'title');
        } else if (['ArrowUp', 'ArrowDown'].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          const titles = [...container.querySelectorAll('[data-field="title"]')];
          const next = titles[titles.indexOf(node) + (event.key === 'ArrowUp' ? -1 : 1)];
          if (next) {
            const column = node.selectionStart;
            next.focus();
            next.setSelectionRange(Math.min(column, next.value.length), Math.min(column, next.value.length));
            next.scrollIntoView({ block: 'nearest' });
          }
        }
      });
    }
    function shown(path, text) {
      const tagFilters = tagList();
      const rows = rowsFor(text);
      const byLine = new Map(rows.map(row => [row.line, row]));
      const keptLines = new Set(keepFor(path));
      const visible = new Set();
      for (const row of rows) {
        const words = (row.title + '\n' + row.note).split(/\s+/);
        const matches = (filter === 'all' || (filter === 'not-done' ? row.status !== 'done' : row.status === filter)) && tagFilters.every(tag => words.includes('#' + tag))
          && row.title.toLowerCase().includes(textSearch.trim().toLowerCase());
        if (!keptLines.has(row.line) && !matches) continue;
        let ancestor = row;
        while (ancestor) {
          visible.add(ancestor.line);
          ancestor = byLine.get(ancestor.parentLine);
        }
      }
      return visible;
    }
    function selectRow(path, row, event) {
      const rows = rowsFor(docs.get(path).text);
      const previous = rows.find(value => selectedLines.has(value.line));
      if (selectedPath !== path || previous && previous.parentLine !== row.parentLine || !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        clearSelection();
        selectedPath = path;
      }
      if (event.shiftKey && selectionAnchor !== null) {
        const visible = shown(path, docs.get(path).text);
        for (const sibling of rows) {
          if (sibling.parentLine === row.parentLine && visible.has(sibling.line) && sibling.line >= Math.min(selectionAnchor, row.line) && sibling.line <= Math.max(selectionAnchor, row.line)) selectedLines.add(sibling.line);
        }
      } else {
        if (selectedLines.has(row.line)) selectedLines.delete(row.line); else selectedLines.add(row.line);
        selectionAnchor = row.line;
      }
      active = null;
      render();
    }
    function reorderSelection(path, target, position) {
      if (selectedPath !== path || !selectedLines.size) return;
      let result;
      mutate(path, text => {
        result = core.reorder(text, [...selectedLines], target, position);
        return result;
      }, 'title');
      if (result) {
        selectedPath = path;
        selectedLines = new Set(result.lines);
        selectionAnchor = result.line;
        render();
      }
    }
    function moveSelection(down) {
      const rows = rowsFor(docs.get(selectedPath).text);
      const selected = rows.filter(row => selectedLines.has(row.line));
      const siblings = rows.filter(row => row.parentLine === selected[0].parentLine);
      const edge = down ? selected.at(-1) : selected[0];
      const target = siblings[siblings.indexOf(edge) + (down ? 1 : -1)];
      if (target) reorderSelection(selectedPath, target.line, down ? 'after' : 'before');
    }
    // Only http(s) targets become anchors; any other Markdown link stays plain text.
    const markdownLink = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
    // Shows Markdown links as anchors while the title is not focused; the textarea keeps the raw Markdown.
    function showLinks(titleArea, title) {
      const display = el('div', 'title-display');
      const fill = () => {
        display.replaceChildren();
        let rest = title.value, match;
        while ((match = rest.match(markdownLink))) {
          const link = el('a', '', match[1]);
          link.href = match[2];
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          display.append(rest.slice(0, match.index), link);
          rest = rest.slice(match.index + match[0].length);
        }
        display.append(rest);
      };
      fill();
      display.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        title.focus();
        title.setSelectionRange(title.value.length, title.value.length);
      });
      title.addEventListener('focus', () => titleArea.classList.add('is-editing'));
      title.addEventListener('blur', () => { titleArea.classList.remove('is-editing'); fill(); });
      titleArea.classList.add('has-links');
      titleArea.append(display);
    }
    function renderOutline(parent, path, chain = []) {
      if (chain.includes(path)) {
        parent.append(el('div', 'notice', 'このファイルはすでに埋め込まれています。循環する埋め込みは表示できません。'));
        parent.append(button('このファイルを開く', '埋め込み先のファイルを直接開く', () => openFile(path), 'quiet'));
        return;
      }
      const doc = docs.get(path);
      if (!doc) { parent.append(el('div', 'notice', 'ファイルを開けません。保存先とファイル名を確認してください。')); return; }
      const rows = rowsFor(doc.text);
      renderedRows.set(path, [...(renderedRows.get(path) || []), ...rows]);
      const visible = shown(path, doc.text);
      const byLine = new Map(rows.map(row => [row.line, row]));
      const rootRow = zoom && zoom.path === path ? byLine.get(zoom.line) : null;
      if (rootRow) {
        const heading = el('section', 'zoom-heading');
        const title = el('textarea', 'title-input zoom-title');
        title.rows = 1;
        title.wrap = 'soft';
        title.value = rootRow.title;
        title.placeholder = 'タイトルを入力';
        title.setAttribute('aria-label', 'ズーム対象のタイトル');
        editControl(title, path, rootRow, 'title');
        heading.append(title);
        if (rootRow.kind === 'task') {
          const index = statuses.findIndex(([value]) => value === rootRow.status);
          const [nextStatus, nextLabel] = statuses[(index + 1) % statuses.length];
          const state = button({ todo: '○', 'in-progress': '◐', done: '✓' }[rootRow.status], 'ズーム対象を' + nextLabel + 'にする',
            () => mutate(path, text => core.updateStatus(text, rootRow.line, nextStatus), 'title'), 'task-status');
          state.setAttribute('aria-label', 'ズーム対象を' + nextLabel + 'にする');
          heading.append(state);
        }
        heading.append(button('ノート', 'ズーム対象のノートを編集', () => { active = { path, line: rootRow.line, field: 'note' }; render(); }, 'quiet'));
        if (rootRow.note || active?.path === path && active.line === rootRow.line && active.field === 'note') {
          const note = el('textarea', 'note-input zoom-note');
          note.value = rootRow.note || '';
          note.rows = Math.max(1, Math.min(8, note.value.split('\n').length));
          note.setAttribute('aria-label', 'ズーム対象のノート');
          editControl(note, path, rootRow, 'note');
          heading.append(note);
        }
        parent.append(heading);
      }
      const renderedItems = new Map();
      const clearDrop = () => {
        for (const node of parent.querySelectorAll('.drop-before, .drop-after, .drop-child')) node.classList.remove('drop-before', 'drop-after', 'drop-child');
      };
      const bindDrop = (node, destination) => {
        node.addEventListener('dragover', event => {
          if (!dragging || dragging.path !== path) return;
          const drop = destination(event);
          if (!drop) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          clearDrop();
          node.style.setProperty('--drop-offset', (drop.offset || 0) + 'px');
          node.classList.add(drop.indicator);
        });
        node.addEventListener('dragleave', clearDrop);
        node.addEventListener('drop', event => {
          if (!dragging || dragging.path !== path) return;
          const drop = destination(event);
          if (!drop) return;
          event.preventDefault();
          const lines = [...dragging.lines];
          dragging = null;
          container.classList.remove('is-dragging');
          clearDrop();
          if (drop.parentLine !== null || lines.some(value => byLine.get(value)?.parentLine !== null)) {
            mutate(path, text => {
              const result = core.reparent(text, lines, drop.parentLine, drop.beforeLine);
              if (drop.parentLine !== null) collapsed.delete(key(path, drop.parentLine));
              return result;
            }, 'title');
          } else {
            selectedPath = path;
            selectedLines = new Set(lines);
            reorderSelection(path, drop.line, drop.position);
          }
        });
      };
      let count = 0;
      for (const row of rows) {
        if (rootRow && !(row.line > rootRow.line && row.line < rootRow.end)) continue;
        if (!visible.has(row.line) && row.kind !== 'embed') continue;
        let ancestor = byLine.get(row.parentLine);
        let hidden = false;
        while (ancestor) {
          if (collapsed.has(key(path, ancestor.line))) { hidden = true; break; }
          ancestor = byLine.get(ancestor.parentLine);
        }
        if (hidden) continue;
        count++;
        const item = el('div', 'outline-item' + (row.status === 'done' ? ' is-done' : ''));
        item.style.setProperty('--depth', Math.max(0, row.depth - (rootRow ? rootRow.depth + 1 : 0)));
        const line = el('div', 'outline-line');
        if (selectedPath === path && selectedLines.has(row.line)) item.classList.add('is-selected');
        const hasChildren = rows.some(child => child.parentLine === row.line);
        const fold = button(collapsed.has(key(path, row.line)) ? '▸' : '▾', '子項目を折りたたむ／開く', () => {
          const id = key(path, row.line);
          if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
          active = null;
          render();
        }, 'icon fold');
        fold.disabled = !hasChildren && row.kind !== 'embed';
        line.append(fold);
        if (row.kind === 'embed') {
          line.append(el('span', 'embed-title', row.embed));
          item.append(line);
          if (collapsed.has(key(path, row.line))) { parent.append(item); continue; }
          const embedded = el('div', 'embedded');
          embedded.append(el('div', 'source-label', 'ファイル: ' + row.embed));
          try {
            const targetPath = normalize(path, row.embed);
            embedded.append(button('このファイルを開く', '埋め込み先のファイルを直接開く', () => openFile(targetPath), 'quiet'));
            renderOutline(embedded, targetPath, [...chain, path]);
          }
          catch (error) { embedded.append(el('div', 'notice', error.message)); }
          item.append(embedded);
          parent.append(item);
          continue;
        }
        const handle = button('⠿', '項目を選択／ドラッグして移動', event => selectRow(path, row, event), 'icon drag-handle');
        handle.setAttribute('aria-pressed', String(selectedPath === path && selectedLines.has(row.line)));
        handle.draggable = true;
        handle.addEventListener('dragstart', event => {
          const lines = selectedPath === path && selectedLines.has(row.line) ? [...selectedLines] : [row.line];
          dragging = { path, lines };
          container.classList.add('is-dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', row.title);
        });
        handle.addEventListener('dragend', () => {
          dragging = null;
          container.classList.remove('is-dragging');
          for (const node of container.querySelectorAll('.drop-before, .drop-after, .drop-child')) node.classList.remove('drop-before', 'drop-after', 'drop-child');
        });
        bindDrop(line, event => {
          const bounds = line.getBoundingClientRect();
          const fraction = (event.clientY - bounds.top) / bounds.height;
          const titleLeft = line.querySelector('.title-input').getBoundingClientRect().left;
          if (!hasChildren && fraction >= .25 && fraction <= .75 && event.clientX >= titleLeft) {
            return { parentLine: row.line, beforeLine: null, indicator: 'drop-child', offset: 24 };
          }
          const position = fraction < .5 ? 'before' : 'after';
          let targetRow = row;
          let offset = 0;
          while (targetRow.parentLine !== null && targetRow.parentLine !== rootRow?.line && event.clientX < titleLeft + offset - 12) {
            targetRow = byLine.get(targetRow.parentLine);
            offset -= 24;
          }
          const siblings = rows.filter(candidate => candidate.parentLine === targetRow.parentLine);
          const beforeLine = position === 'before' ? targetRow.line : siblings[siblings.indexOf(targetRow) + 1]?.line ?? null;
          return { parentLine: targetRow.parentLine, beforeLine, line: targetRow.line, position, indicator: 'drop-' + position, offset };
        });
        line.append(handle);
        if (row.kind === 'task') {
          const index = statuses.findIndex(([value]) => value === row.status);
          const [nextStatus, nextLabel] = statuses[(index + 1) % statuses.length];
          const label = statuses[index][1] + '（クリックで' + nextLabel + '）';
          const state = button({ todo: '○', 'in-progress': '◐', done: '✓' }[row.status], label,
            () => mutate(path, text => core.updateStatus(text, row.line, nextStatus), 'title'), 'task-status');
          state.setAttribute('aria-label', label);
          state.dataset.status = row.status;
          line.append(state);
        } else line.append(el('span', 'bullet', '•'));
        const title = el('textarea', 'title-input');
        title.rows = 1;
        title.wrap = 'soft';
        title.value = row.title;
        title.placeholder = row.kind === 'task' ? 'タスクを入力' : '箇条書きを入力';
        title.setAttribute('aria-label', '項目の内容');
        editControl(title, path, row, 'title');
        const titleArea = el('div', 'title-area');
        titleArea.append(title);
        if (markdownLink.test(row.title)) showLinks(titleArea, title);
        line.append(titleArea);
        const actions = el('div', 'row-actions');
        actions.append(
          button('+', row.kind === 'task' ? '子タスクを追加' : '子の箇条書きを追加', () => add(path, row.line, true), 'icon'),
          button('ノート', 'ノートを編集', () => { active = { path, line: row.line, field: 'note' }; render(); }, 'quiet'),
          button('↗', 'この項目にズーム', () => { zoom = { path, line: row.line }; collapsed.delete(key(path, row.line)); active = null; render(); }, 'icon'),
          button('↑', '項目を上へ移動', () => mutate(path, text => core.move(text, row.line, 'up'), 'title'), 'icon'),
          button('↓', '項目を下へ移動', () => mutate(path, text => core.move(text, row.line, 'down'), 'title'), 'icon'),
          button('ファイルにする', '項目を子とノートごと新しいファイルへ移して埋め込みにする', () => extractToFile(path, row.line), 'quiet')
        );
        line.append(actions);
        item.append(line);
        if (row.note || active && active.path === path && active.line === row.line && active.field === 'note') {
          const note = el('textarea', 'note-input');
          note.value = row.note || '';
          note.placeholder = 'ノートを入力';
          note.rows = Math.max(1, Math.min(8, note.value.split('\n').length));
          note.setAttribute('aria-label', '項目のノート');
          editControl(note, path, row, 'note');
          item.append(note);
        }
        parent.append(item);
        renderedItems.set(row.line, item);
      }
      for (const row of rows) {
        if (row.kind === 'embed' || !renderedItems.has(row.line) || !rows.some(child => child.parentLine === row.line)) continue;
        const descendants = rows.filter(child => child.line >= row.line && child.line < row.end && renderedItems.has(child.line));
        const lastItem = renderedItems.get(descendants.at(-1).line);
        const end = el('div', 'children-end');
        end.style.setProperty('--depth', Math.max(0, row.depth + 1 - (rootRow ? rootRow.depth + 1 : 0)));
        end.setAttribute('aria-label', row.title + ' の子項目の末尾');
        bindDrop(end, () => ({ parentLine: row.line, beforeLine: null, indicator: 'drop-after' }));
        lastItem.after(end);
      }
      if (!count) parent.append(el('div', 'empty', '表示する項目がありません。「＋」で入力できます。'));
      const siblings = rows.filter(row => row.parentLine === (rootRow ? rootRow.line : null));
      const last = siblings.at(-1);
      const lastEditable = siblings.filter(row => row.kind !== 'embed').at(-1);
      const addArea = el('div', 'outline-add');
      const kindSelect = el('select', 'add-kind');
      kindSelect.setAttribute('aria-label', '追加する項目の種類');
      for (const [value, label] of [['task', 'タスク'], ['bullet', '箇条書き']]) {
        const option = el('option', '', label);
        option.value = value;
        kindSelect.append(option);
      }
      kindSelect.value = lastEditable?.kind === 'bullet' ? 'bullet' : 'task';
      const append = button('＋', 'リストの末尾に項目を追加', () => {
        if (!rootRow) add(path, null, false, kindSelect.value);
        else if (last) add(path, last.line, false, kindSelect.value);
        else add(path, rootRow.line, true, kindSelect.value);
      }, 'icon append-item');
      append.setAttribute('aria-label', 'リストの末尾に項目を追加');
      addArea.append(append, kindSelect);
      parent.append(addArea);
    }
    let stateLabel;
    let alertArea;
    function validBookmark(bookmark) {
      return bookmark && typeof bookmark.id === 'string' && ['file', 'search'].includes(bookmark.kind)
        && typeof bookmark.file === 'string' && bookmark.file.length > 0
        && ['all', ...statuses.map(([status]) => status)].includes(bookmark.status)
        && Array.isArray(bookmark.tags) && bookmark.tags.every(tag => typeof tag === 'string')
        && (bookmark.searchText === undefined || typeof bookmark.searchText === 'string');
    }
    function persistPreferences() {
      if (!savePreferences) return;
      const snapshot = JSON.parse(JSON.stringify(preferences));
      preferenceSave = preferenceSave.then(() => savePreferences(snapshot)).catch(error => {
        if (!destroyed) showToast('画面設定を保存できませんでした: ' + error.message);
      });
    }
    function addBookmark(kind) {
      if (!Array.isArray(preferences.bookmarks)) {
        showToast('ブックマークの設定を読み込めません。設定ファイルを確認してください。');
        return;
      }
      const bookmark = { id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2), kind, file: current,
        status: kind === 'file' ? 'all' : filter, tags: kind === 'file' ? [] : tagList(), searchText: kind === 'file' ? '' : textSearch.trim() };
      if (preferences.bookmarks.some(saved => validBookmark(saved) && saved.kind === kind && saved.file === bookmark.file
        && saved.status === bookmark.status && JSON.stringify(saved.tags) === JSON.stringify(bookmark.tags)
        && (saved.searchText || '') === bookmark.searchText)) {
        showToast('このブックマークは登録済みです。');
        return;
      }
      preferences.bookmarks.push(bookmark);
      persistPreferences();
      render();
    }
    function currentSearchBookmark() {
      return Array.isArray(preferences.bookmarks) && preferences.bookmarks.find(saved => validBookmark(saved)
        && saved.kind === 'search' && saved.file === current && saved.status === filter
        && JSON.stringify(saved.tags) === JSON.stringify(tagList()) && (saved.searchText || '') === textSearch.trim());
    }
    async function openBookmark(bookmark) {
      if (!validBookmark(bookmark)) { showToast('このブックマークの設定は読み込めません。'); return; }
      try { await loadEmbeds(bookmark.file); }
      catch (error) { showToast('ブックマークを開けませんでした: ' + error.message); return; }
      if (destroyed) return;
      filter = bookmark.kind === 'file' ? 'all' : bookmark.status;
      tags = bookmark.kind === 'file' ? '' : bookmark.tags.map(tag => '#' + tag).join(' ');
      textSearch = bookmark.kind === 'file' ? '' : bookmark.searchText || '';
      kept.clear();
      await openFile(bookmark.file);
    }
    function renderBookmarks() {
      const minimized = preferences.sidebarCollapsed === true;
      const sidebar = el('aside', 'bookmarks' + (minimized ? ' is-collapsed' : ''));
      sidebar.setAttribute('aria-label', 'ブックマーク');
      const heading = el('div', 'bookmarks-header');
      const toggleLabel = minimized ? 'サイドバーを展開' : 'サイドバーを縮小';
      const toggle = button(minimized ? '›' : '‹', toggleLabel, () => {
        preferences.sidebarCollapsed = !minimized;
        persistPreferences();
        render();
      }, 'icon sidebar-toggle');
      toggle.setAttribute('aria-label', toggleLabel);
      toggle.setAttribute('aria-expanded', String(!minimized));
      heading.append(toggle);
      if (!minimized) heading.prepend(el('h2', 'bookmarks-heading', 'ブックマーク'));
      sidebar.append(heading);
      if (minimized) return sidebar;
      const actions = el('div', 'bookmark-actions');
      actions.append(button('ファイルを追加', '表示中のファイルをブックマーク', () => addBookmark('file')));
      sidebar.append(actions);
      if (!Array.isArray(preferences.bookmarks)) {
        sidebar.append(el('p', 'bookmark-empty', '設定を読み込めません。'));
        return sidebar;
      }
      const list = el('ul', 'bookmark-list');
      for (const bookmark of preferences.bookmarks) {
        const item = el('li', 'bookmark-item');
        const valid = validBookmark(bookmark);
        const filename = valid ? bookmark.file.split('/').pop() : '読み込めないブックマーク';
        const state = valid ? [['all', 'すべて'], ['not-done', '完了以外'], ...statuses].find(([value]) => value === bookmark.status)[1] : '';
        const label = valid && bookmark.kind === 'search' ? state + (bookmark.tags.length ? ' ' + bookmark.tags.map(tag => '#' + tag).join(' ') : '')
          + (bookmark.searchText ? '「' + bookmark.searchText + '」' : '') + ' · ' + filename : filename;
        const open = button(label, valid ? bookmark.file : label, () => openBookmark(bookmark), 'bookmark-open');
        const remove = button('×', label + ' を削除', () => {
          preferences.bookmarks.splice(preferences.bookmarks.indexOf(bookmark), 1);
          persistPreferences();
          render();
        }, 'icon');
        remove.setAttribute('aria-label', label + ' を削除');
        item.append(open, remove);
        list.append(item);
      }
      sidebar.append(list);
      if (!preferences.bookmarks.length) sidebar.append(el('p', 'bookmark-empty', 'ファイルや検索条件を登録できます。'));
      return sidebar;
    }
    function updateStatus() {
      if (!stateLabel) return;
      const dirty = [...docs.values()].filter(doc => doc.dirty).length;
      const conflicts = [...docs.values()].filter(doc => doc.conflict).length;
      stateLabel.textContent = busy ? '処理中…' : conflicts ? '保存競合 ' + conflicts + ' ファイル（入力保持）' : dirty ? '未保存 ' + dirty + ' ファイル' : '保存済み';
      stateLabel.classList.toggle('dirty', !!dirty);
    }
    function render() {
      if (destroyed) return;
      // Replacing the DOM between pointerdown and pointerup drops the click, so wait for the release.
      if (composing || pressing) { deferred = true; return; }
      deferred = false;
      const focus = active && { ...active };
      const oldNode = document.activeElement;
      const selection = oldNode && typeof oldNode.selectionStart === 'number' ? [oldNode.selectionStart, oldNode.selectionEnd] : null;
      renderedRows.clear();
      rendering = true;
      container.replaceChildren();
      container.classList.add('outliner');
      const workspace = el('div', 'outliner-workspace');
      const editor = el('div', 'outliner-editor');
      workspace.append(renderBookmarks(), editor);
      container.append(workspace);
      const header = el('header', 'app-header');
      header.append(el('div', 'app-name', 'Markdown Outliner'));
      stateLabel = el('span', 'save-state');
      header.append(stateLabel);
      const toolbar = el('div', 'toolbar');
      const files = el('select', 'file-select');
      files.setAttribute('aria-label', '開くファイル');
      for (const path of fileList) {
        const option = el('option', '', path);
        option.value = path;
        files.append(option);
      }
      files.value = current;
      files.addEventListener('change', () => openFile(files.value));
      toolbar.append(files, statusSelect(filter, value => { filter = value; kept.clear(); active = null; render(); }));
      const searchInput = el('input', 'title-search');
      searchInput.type = 'search';
      searchInput.value = searchValue();
      searchInput.placeholder = '語句・#タグで絞り込み';
      searchInput.setAttribute('aria-label', '語句・タグで絞り込み');
      searchInput.addEventListener('input', () => { parseSearch(searchInput.value); updateStar(); });
      const applySearch = () => { parseSearch(searchInput.value); kept.clear(); active = null; render(); };
      searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); applySearch(); }
      });
      const searchBox = el('div', 'search-box');
      const star = button('☆', '検索をブックマーク', () => {
        const existing = currentSearchBookmark();
        if (existing) {
          preferences.bookmarks.splice(preferences.bookmarks.indexOf(existing), 1);
          persistPreferences();
          render();
        } else addBookmark('search');
      }, 'search-star');
      const updateStar = () => {
        const saved = !!currentSearchBookmark();
        const label = saved ? '検索のブックマークを解除' : '検索をブックマーク';
        star.textContent = saved ? '★' : '☆';
        star.title = label;
        star.setAttribute('aria-label', label);
        star.setAttribute('aria-pressed', String(saved));
      };
      updateStar();
      searchBox.append(searchInput, star);
      toolbar.append(searchBox);
      if (adapter.openSource) {
        toolbar.append(button('Markdown で開く', '表示中の元ファイルを通常エディタで開く', async () => {
          try { await adapter.openSource(zoom ? zoom.path : current); }
          catch (error) { message = error.message; render(); }
        }));
      }
      toolbar.append(
        button('リセット', '検索・タグ・状態の絞り込みをリセット', () => {
          filter = 'all';
          tags = '';
          textSearch = '';
          kept.clear();
          active = null;
          render();
        }),
        button('保存', '変更したファイルを保存', saveAll),
        button('再読込', '変更があるファイルは保存するか入力を保持します', reload),
        button('Undo', '元に戻す', () => history(true)),
        button('Redo', 'やり直す', () => history(false)));
      const saveMode = el('label', 'auto-save');
      const toggle = el('input');
      toggle.type = 'checkbox';
      toggle.checked = autoSave;
      toggle.setAttribute('aria-label', '自動保存');
      toggle.addEventListener('change', () => { autoSave = toggle.checked; scheduleSave(); });
      saveMode.append(toggle, document.createTextNode('自動保存'));
      toolbar.append(saveMode);
      if (selectedLines.size) {
        const selectionBar = el('div', 'selection-bar');
        selectionBar.append(el('span', '', selectedLines.size + ' 項目を選択'),
          button('↑', '選択した項目をまとめて上へ移動', () => moveSelection(false)),
          button('↓', '選択した項目をまとめて下へ移動', () => moveSelection(true)));
        for (const [status, label] of statuses) selectionBar.append(button(label, '選択したタスクを' + label + 'にする', () => {
          const path = selectedPath;
          const lines = [...selectedLines];
          mutate(path, text => {
            let result = { text, line: lines[0] };
            for (const value of lines) if (rowsFor(result.text).find(row => row.line === value)?.kind === 'task') result = core.updateStatus(result.text, value, status);
            return result;
          }, 'title');
        }));
        selectionBar.append(button('選択解除', '選択した項目を解除', () => { clearSelection(); render(); }));
        toolbar.append(selectionBar);
      }
      header.append(toolbar);
      editor.append(header);
      if (zoom) {
        const crumb = el('div', 'zoom-bar');
        crumb.append(button('← 全体に戻る', 'ズームを解除', () => { zoom = null; active = null; render(); }, 'quiet'), el('span', '', zoom.path));
        editor.append(crumb);
      }
      alertArea = el('div', 'alerts');
      alertArea.setAttribute('aria-live', 'polite');
      if (message) alertArea.append(el('div', 'notice', message));
      for (const [path, doc] of docs) {
        if (!doc.conflict) continue;
        const panel = el('div', 'conflict');
        panel.append(el('p', '', path + ' に外部の変更があります。入力内容を残しています。必要ならコピーしてから外部の内容を開いてください。'));
        const local = el('textarea', 'local-copy');
        local.readOnly = true;
        local.value = doc.text;
        local.setAttribute('aria-label', path + ' の保存前の入力内容');
        panel.append(local, button('入力内容をコピー', '入力内容を選択してコピー', () => {
          local.focus(); local.select();
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(doc.text).catch(() => { message = '入力内容を選択しました。コピーしてください。'; });
        }), button('外部の内容を開く', '入力内容を履歴に残して外部の内容へ切り替える', async () => {
          try {
            const result = await adapter.read(path);
            remember();
            docs.set(path, { text: result.text, baseRevision: result.revision, dirty: false, conflict: false });
            clearSelection();
            message = '';
            active = null;
            render();
          } catch (error) { message = error.message; render(); }
        }));
        alertArea.append(panel);
      }
      editor.append(alertArea);
      const outline = el('main', 'outline');
      if (docs.has(current)) renderOutline(outline, zoom ? zoom.path : current);
      else outline.append(el('div', 'empty', 'ファイルを開いています…'));
      editor.append(outline);
      const footer = el('footer', 'help');
      footer.textContent = '↑↓: カーソル移動 · Enter: 追加 · ⌘/Ctrl+Enter: 進行中→完了 · Tab / Shift+Tab: 階層 · Shift+Enter: タスク⇄ノート · ⠿: ドラッグ（挿入線の字下げで階層を表示） · Shift / ⌘クリック: 複数選択';
      editor.append(footer);
      renderToast();
      updateStatus();
      for (const node of container.querySelectorAll('.title-input')) fitTitle(node);
      if (focus) {
        const node = [...container.querySelectorAll('[data-field]')].find(node => node.dataset.path === focus.path && Number(node.dataset.line) === focus.line && node.dataset.field === focus.field);
        if (node) {
          node.focus();
          if (selection) node.setSelectionRange(Math.min(selection[0], node.value.length), Math.min(selection[1], node.value.length));
        }
      }
      rendering = false;
    }
    let fileList = [initialFile];
    async function openFile(path) {
      if (!fileList.includes(path)) fileList.push(path);
      current = path;
      clearSelection();
      zoom = null;
      active = null;
      message = '';
      render();
      try { await loadEmbeds(path); }
      catch (error) { message = error.message; }
      render();
    }
    async function saveAll(automatic = false) {
      if (busy) return;
      busy = true;
      message = '';
      updateStatus();
      for (const [path, doc] of docs) {
        if (!doc.dirty || automatic === true && doc.conflict) continue;
        const savingText = doc.text;
        try {
          const result = await adapter.save(path, savingText, doc.baseRevision);
          doc.baseRevision = result.revision;
          doc.dirty = doc.text !== savingText;
          doc.conflict = false;
        } catch (error) {
          doc.conflict = true;
          message = '保存できませんでした: ' + error.message;
        }
      }
      busy = false;
      if (message) alertArea.replaceChildren(el('div', 'notice', message));
      scheduleSave();
      if (active || composing) { deferred = true; updateStatus(); }
      else render();
    }
    async function reload() {
      if (busy) return;
      message = '';
      for (const [path, doc] of docs) {
        try {
          const result = await adapter.read(path);
          if (doc.dirty) {
            if (result.revision !== doc.baseRevision) doc.conflict = true;
            message = '未保存の入力を保持しています。保存後に再読込してください。';
          } else {
            if (doc.text !== result.text) clearSelection();
            doc.text = result.text;
            doc.baseRevision = result.revision;
          }
        } catch (error) { message = error.message; }
      }
      await loadEmbeds(current);
      if (active || composing) { deferred = true; updateStatus(); } else render();
    }
    async function poll() {
      if (destroyed || busy || polling) return;
      polling = true;
      let changed = false;
      try {
        for (const [path, doc] of docs) {
          try {
            const result = await adapter.read(path);
            if (result.revision === doc.baseRevision) continue;
            if (doc.dirty) { if (!doc.conflict) changed = true; doc.conflict = true; }
            else if (active || composing) { deferred = true; }
            else {
              clearSelection();
              undo.length = 0;
              redo.length = 0;
              if (zoom?.path === path) zoom = null;
              doc.text = result.text;
              doc.baseRevision = result.revision;
              changed = true;
            }
          } catch (error) { if (message !== error.message) changed = true; message = error.message; }
        }
        const focused = document.activeElement;
        const editingControl = container.contains(focused) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName) && focused.type !== 'checkbox';
        if (changed || deferred && !editingControl) {
          await loadEmbeds(current);
          if (active || composing || editingControl) { deferred = true; } else render();
        }
      } finally { polling = false; updateStatus(); }
    }
    function keyboard(event) {
      if (event.isComposing || composing || event.keyCode === 229) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        history(!event.shiftKey);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); saveAll();
      }
    }
    const press = () => { pressing = true; };
    const release = () => {
      if (!pressing) return;
      pressing = false;
      // Runs after the click that follows this pointerup, then applies any deferred render.
      if (deferred) setTimeout(poll);
    };
    container.addEventListener('keydown', keyboard);
    container.addEventListener('pointerdown', press, true);
    // A drag never produces a click, and some browsers skip pointercancel when a drag starts.
    container.addEventListener('dragstart', release, true);
    container.ownerDocument.addEventListener('pointerup', release, true);
    container.ownerDocument.addEventListener('pointercancel', release, true);
    const timer = setInterval(poll, 3000);
    render();
    adapter.list().then(list => {
      fileList = [...new Set([initialFile, ...list])];
      return openFile(current);
    }).catch(error => { message = error.message; render(); });
    return {
      completeActive,
      destroy() {
        destroyed = true;
        clearInterval(timer);
        resizeObserver?.disconnect();
        clearTimeout(saveTimer);
        clearToast();
        container.removeEventListener('keydown', keyboard);
        container.removeEventListener('pointerdown', press, true);
        container.removeEventListener('dragstart', release, true);
        container.ownerDocument.removeEventListener('pointerup', release, true);
        container.ownerDocument.removeEventListener('pointercancel', release, true);
        container.replaceChildren();
      }
    };
  }
  return { mount };
});
