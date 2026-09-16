(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const CODE_FORMAT = 'json';

  let activeEditor = null;
  let previewObserver = null;
  let codeMode = false;
  let bypassSearchInterception = false;
  let renderingCode = false;
  let cachedTable = { headers: [], rows: [] };
  let codeSearch = '';

  function currentFormat() {
    return window.__TableSnapEditorFormatSettings?.getFormat?.() || 'csv';
  }

  function jsonOptions() {
    return window.__TableSnapEditorFormatSettings?.getOptions?.('json') || {
      prettyPrint: true,
      indentation: 2,
      headersAsKeys: true,
      includeEmptyValues: true
    };
  }

  function editorSettings() {
    return window.__TableSnapEditorSettings?.getState?.() || { includeHeaders: true };
  }

  function toSnakeCase(value, fallback) {
    const normalized = String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    return normalized || fallback;
  }

  function uniqueKeys(headers) {
    const seen = new Map();
    return headers.map((header, index) => {
      const base = toSnakeCase(header, `column_${index + 1}`);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}_${count + 1}`;
    });
  }

  function readCurrentTable(editor) {
    const table = editor?.querySelector('.tablesnap-editor-data-table');
    if (!table) return null;

    const headers = [...table.querySelectorAll('thead th:not(.tablesnap-editor-select-cell)')]
      .map((cell) => cell.textContent || '');
    const rows = [...table.querySelectorAll('tbody tr')]
      .filter((row) => row.dataset.selected === 'true')
      .map((row) => [...row.querySelectorAll('td:not(.tablesnap-editor-select-cell)')]
        .map((cell) => cell.textContent || ''));

    return { headers, rows };
  }

  function serializeJson(snapshot) {
    const options = jsonOptions();
    const settings = editorSettings();
    const useObjects = options.headersAsKeys !== false && settings.includeHeaders !== false;
    let payload;

    if (useObjects) {
      const keys = uniqueKeys(snapshot.headers);
      payload = snapshot.rows.map((row) => {
        const item = {};
        keys.forEach((key, index) => {
          const value = row[index] ?? '';
          if (options.includeEmptyValues === false && value === '') return;
          item[key] = value;
        });
        return item;
      });
    } else {
      payload = snapshot.rows.map((row) => snapshot.headers.map((_, index) => row[index] ?? ''));
    }

    return JSON.stringify(payload, null, options.prettyPrint === false ? 0 : (Number(options.indentation) || 2));
  }

  function appendHighlightedText(parent, text, query) {
    if (!query) {
      parent.append(document.createTextNode(text));
      return;
    }
    const lower = text.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    let offset = 0;
    while (offset < text.length) {
      const index = lower.indexOf(needle, offset);
      if (index < 0) {
        parent.append(document.createTextNode(text.slice(offset)));
        break;
      }
      if (index > offset) parent.append(document.createTextNode(text.slice(offset, index)));
      const mark = document.createElement('mark');
      mark.className = 'tablesnap-editor-code-match';
      mark.textContent = text.slice(index, index + needle.length);
      parent.append(mark);
      offset = index + needle.length;
    }
  }

  function tokenizedJson(code, query) {
    const fragment = document.createDocumentFragment();
    const tokenPattern = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(code))) {
      if (match.index > lastIndex) appendHighlightedText(fragment, code.slice(lastIndex, match.index), query);
      const raw = match[0];
      const token = document.createElement('span');
      if (raw.startsWith('"')) {
        const after = code.slice(match.index + raw.length);
        token.className = /^\s*:/.test(after) ? 'tablesnap-editor-code-key' : 'tablesnap-editor-code-string';
      } else if (raw === 'true' || raw === 'false') {
        token.className = 'tablesnap-editor-code-boolean';
      } else if (raw === 'null') {
        token.className = 'tablesnap-editor-code-null';
      } else {
        token.className = 'tablesnap-editor-code-number';
      }
      appendHighlightedText(token, raw, query);
      fragment.append(token);
      lastIndex = match.index + raw.length;
    }
    if (lastIndex < code.length) appendHighlightedText(fragment, code.slice(lastIndex), query);
    return fragment;
  }

  function searchInput(editor) {
    return editor?.querySelector('[data-table-search]') || null;
  }

  function setSearch(editor, value, allowFoundation = false) {
    const input = searchInput(editor);
    if (!input) return;
    input.value = value;
    if (allowFoundation) bypassSearchInterception = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    bypassSearchInterception = false;
  }

  function setHeader(editor, isCode) {
    const title = editor.querySelector('.tablesnap-editor-preview-title-row strong');
    const count = editor.querySelector('[data-table-count]');
    const input = searchInput(editor);
    if (title) title.textContent = isCode ? 'JSON Preview' : 'Table Preview';
    if (input) input.placeholder = isCode ? 'Search in JSON...' : 'Search in table...';
    if (isCode && count) {
      count.textContent = `${cachedTable.rows.length} row${cachedTable.rows.length === 1 ? '' : 's'} × ${cachedTable.headers.length} columns`;
    }
  }

  function ensurePreviewToggle(editor, isCode) {
    const row = editor.querySelector('.tablesnap-editor-preview-title-row');
    if (!row) return;
    row.querySelector('[data-output-preview-toggle]')?.remove();

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.outputPreviewToggle = 'true';
    button.className = 'tablesnap-editor-preview-toggle';
    if (isCode) {
      button.setAttribute('aria-label', 'Back to table preview');
      button.title = 'Back to table';
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m11.5 5-5 5 5 5M7 10h7"/></svg>';
      button.addEventListener('click', () => showTable(editor));
    } else {
      button.setAttribute('aria-label', 'View JSON preview');
      button.title = 'View JSON';
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4a2 2 0 0 0-2 2v2.5C5 9.8 4.4 10.7 3.5 11c.9.3 1.5 1.2 1.5 2.5V16a2 2 0 0 0 2 2M13 4a2 2 0 0 1 2 2v2.5c0 1.3.6 2.2 1.5 2.5-.9.3-1.5 1.2-1.5 2.5V16a2 2 0 0 1-2 2"/></svg>';
      button.addEventListener('click', () => {
        const latest = readCurrentTable(editor);
        if (latest) cachedTable = latest;
        codeMode = true;
        codeSearch = '';
        setSearch(editor, '', true);
        renderCode(editor);
      });
    }
    row.insertBefore(button, row.firstChild);
  }

  function renderCode(editor) {
    if (!editor?.isConnected || !codeMode || currentFormat() !== CODE_FORMAT) return;
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;

    renderingCode = true;
    const code = serializeJson(cachedTable);
    const scroller = document.createElement('div');
    scroller.className = 'tablesnap-editor-code-scroll';
    const pre = document.createElement('pre');
    pre.className = 'tablesnap-editor-code-preview';
    const codeNode = document.createElement('code');
    codeNode.append(tokenizedJson(code, codeSearch));
    pre.append(codeNode);
    scroller.append(pre);
    preview.replaceChildren(scroller);
    setHeader(editor, true);
    ensurePreviewToggle(editor, true);
    renderingCode = false;
  }

  function showTable(editor) {
    if (!editor?.isConnected) return;
    codeMode = false;
    codeSearch = '';
    setHeader(editor, false);
    setSearch(editor, '', true);
    ensurePreviewToggle(editor, false);
  }

  function enterJsonPreview(editor) {
    if (!editor?.isConnected) return;
    codeMode = false;
    codeSearch = '';
    setSearch(editor, '', true);
    const snapshot = readCurrentTable(editor);
    if (snapshot) cachedTable = snapshot;
    codeMode = true;
    renderCode(editor);
  }

  function leaveJsonPreview(editor) {
    if (!editor?.isConnected) return;
    codeMode = false;
    codeSearch = '';
    editor.querySelector('[data-output-preview-toggle]')?.remove();
    setHeader(editor, false);
    setSearch(editor, '', true);
  }

  function handleFormatChange() {
    if (!activeEditor?.isConnected) return;
    if (currentFormat() === CODE_FORMAT) {
      if (!codeMode) enterJsonPreview(activeEditor);
      else renderCode(activeEditor);
    } else if (codeMode || activeEditor.querySelector('[data-output-preview-toggle]')) {
      leaveJsonPreview(activeEditor);
    }
  }

  function handleSearch(event) {
    if (bypassSearchInterception || !codeMode || currentFormat() !== CODE_FORMAT) return;
    const input = event.target.closest?.('[data-table-search]');
    if (!input || !activeEditor?.contains(input)) return;
    event.stopImmediatePropagation();
    codeSearch = input.value.trim();
    renderCode(activeEditor);
  }

  function observePreview(editor) {
    previewObserver?.disconnect();
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;
    previewObserver = new MutationObserver(() => {
      if (renderingCode || !codeMode || currentFormat() !== CODE_FORMAT) return;
      const snapshot = readCurrentTable(editor);
      if (!snapshot) return;
      cachedTable = snapshot;
      renderCode(editor);
    });
    previewObserver.observe(preview, { childList: true, subtree: true });
  }

  function setupEditor(editor) {
    if (!editor || editor.dataset.outputPreviewReady === 'true') return;
    editor.dataset.outputPreviewReady = 'true';
    activeEditor = editor;
    cachedTable = readCurrentTable(editor) || { headers: [], rows: [] };
    codeMode = false;
    codeSearch = '';
    observePreview(editor);
    if (currentFormat() === CODE_FORMAT) enterJsonPreview(editor);
  }

  function scan() {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (editor) setupEditor(editor);
    if (!editor && activeEditor) {
      previewObserver?.disconnect();
      previewObserver = null;
      activeEditor = null;
      codeMode = false;
      codeSearch = '';
      cachedTable = { headers: [], rows: [] };
    }
  }

  document.addEventListener('tablesnap:editor-format-change', handleFormatChange);
  document.addEventListener('tablesnap:editor-settings-change', () => {
    if (codeMode && currentFormat() === CODE_FORMAT) renderCode(activeEditor);
  });
  document.addEventListener('input', handleSearch, true);

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
