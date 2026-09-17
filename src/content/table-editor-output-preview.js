(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const CODE_FORMATS = new Set(['json', 'sql']);
  const FORMAT_META = {
    json: { label: 'JSON', search: 'Search in JSON...' },
    sql: { label: 'SQL', search: 'Search in SQL...' }
  };

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

  function formatOptions(format) {
    return window.__TableSnapEditorFormatSettings?.getOptions?.(format) || {};
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

  function uniqueNames(headers, fallbackPrefix = 'column') {
    const seen = new Map();
    return headers.map((header, index) => {
      const base = toSnakeCase(header, `${fallbackPrefix}_${index + 1}`);
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
    const options = formatOptions('json');
    const settings = editorSettings();
    const useObjects = options.headersAsKeys !== false && settings.includeHeaders !== false;
    let payload;

    if (useObjects) {
      const keys = uniqueNames(snapshot.headers);
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

  function sqlIdentifierQuote(dialect) {
    return dialect === 'mysql' ? '`' : '"';
  }

  function quoteSqlIdentifier(identifier, options) {
    if (options.quoteIdentifiers === false) return identifier;
    const quote = sqlIdentifierQuote(options.dialect || 'mysql');
    return `${quote}${String(identifier).replaceAll(quote, quote + quote)}${quote}`;
  }

  function sqlValue(value, options) {
    const text = String(value ?? '');
    if (text === '' && options.nullEmptyValues === true) return 'NULL';
    return `'${text.replace(/'/g, "''")}'`;
  }

  function serializeSql(snapshot) {
    const options = formatOptions('sql');
    const columns = uniqueNames(snapshot.headers);
    const table = toSnakeCase(options.tableName || 'table_data', 'table_data');
    const tableName = quoteSqlIdentifier(table, options);
    const columnList = options.includeColumnNames === false
      ? ''
      : ` (${columns.map((column) => quoteSqlIdentifier(column, options)).join(', ')})`;
    const valueGroups = snapshot.rows.map((row) => `(${columns.map((_, index) => sqlValue(row[index] ?? '', options)).join(', ')})`);

    if (!valueGroups.length) return '';
    if (options.multiRowInsert === true) {
      return `INSERT INTO ${tableName}${columnList} VALUES\n${valueGroups.map((group, index) => `  ${group}${index === valueGroups.length - 1 ? ';' : ','}`).join('\n')}`;
    }
    return valueGroups.map((values) => `INSERT INTO ${tableName}${columnList} VALUES ${values};`).join('\n');
  }

  function serializeCode(format, snapshot) {
    if (format === 'sql') return serializeSql(snapshot);
    return serializeJson(snapshot);
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
    const tokenPattern = /\"(?:\\.|[^\"\\])*\"(?=\s*:)|\"(?:\\.|[^\"\\])*\"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g;
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

  function tokenizedSql(code, query) {
    const fragment = document.createDocumentFragment();
    const tokenPattern = /'(?:''|[^'])*'|`(?:``|[^`])*`|"(?:""|[^"])*"|\b(?:INSERT|INTO|VALUES|NULL)\b|-?\d+(?:\.\d+)?/gi;
    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(code))) {
      if (match.index > lastIndex) appendHighlightedText(fragment, code.slice(lastIndex, match.index), query);
      const raw = match[0];
      const token = document.createElement('span');
      if (raw.startsWith("'")) token.className = 'tablesnap-editor-sql-string';
      else if (raw.startsWith('`') || raw.startsWith('"')) token.className = 'tablesnap-editor-sql-identifier';
      else if (raw.toUpperCase() === 'NULL') token.className = 'tablesnap-editor-sql-null';
      else if (/^-?\d/.test(raw)) token.className = 'tablesnap-editor-code-number';
      else token.className = 'tablesnap-editor-sql-keyword';
      appendHighlightedText(token, raw, query);
      fragment.append(token);
      lastIndex = match.index + raw.length;
    }
    if (lastIndex < code.length) appendHighlightedText(fragment, code.slice(lastIndex), query);
    return fragment;
  }

  function tokenizedCode(format, code, query) {
    return format === 'sql' ? tokenizedSql(code, query) : tokenizedJson(code, query);
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
    const format = currentFormat();
    const meta = FORMAT_META[format] || FORMAT_META.json;
    const title = editor.querySelector('.tablesnap-editor-preview-title-row strong');
    const count = editor.querySelector('[data-table-count]');
    const input = searchInput(editor);
    if (title) title.textContent = isCode ? `${meta.label} Preview` : 'Table Preview';
    if (input) input.placeholder = isCode ? meta.search : 'Search in table...';
    if (isCode && count) {
      count.textContent = `${cachedTable.rows.length} row${cachedTable.rows.length === 1 ? '' : 's'} × ${cachedTable.headers.length} columns`;
    }
  }

  function codeTargetIcon(format) {
    if (format === 'sql') {
      return '<svg viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="5" rx="5.5" ry="2.5"/><path d="M4.5 5v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V5M4.5 10v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5"/></svg>';
    }
    return '<span class="tablesnap-editor-json-toggle-glyph" aria-hidden="true">{ }</span>';
  }

  function ensurePreviewToggle(editor, isCode) {
    const head = editor.querySelector('.tablesnap-editor-workspace-head');
    const search = editor.querySelector('.tablesnap-editor-search');
    if (!head || !search) return;
    head.querySelectorAll('[data-output-preview-toggle]').forEach((toggle) => toggle.remove());

    const format = currentFormat();
    if (!CODE_FORMATS.has(format)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.outputPreviewToggle = 'true';
    button.dataset.previewTarget = isCode ? 'table' : format;
    button.className = 'tablesnap-editor-preview-toggle';
    if (isCode) {
      button.setAttribute('aria-label', 'Back to table preview');
      button.title = 'Back to table';
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="4" width="13" height="12" rx="1.5"/><path d="M3.5 8h13M8 4v12M12.5 4v12"/></svg>';
      button.addEventListener('click', () => showTable(editor));
    } else {
      const label = FORMAT_META[format]?.label || format.toUpperCase();
      button.setAttribute('aria-label', `View ${label} preview`);
      button.title = `View ${label}`;
      button.innerHTML = codeTargetIcon(format);
      button.addEventListener('click', () => {
        const latest = readCurrentTable(editor);
        if (latest) cachedTable = latest;
        codeMode = true;
        codeSearch = '';
        setSearch(editor, '', true);
        renderCode(editor);
      });
    }
    head.insertBefore(button, search);
  }

  function renderCode(editor) {
    const format = currentFormat();
    if (!editor?.isConnected || !codeMode || !CODE_FORMATS.has(format)) return;
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;

    renderingCode = true;
    const code = serializeCode(format, cachedTable);
    const scroller = document.createElement('div');
    scroller.className = 'tablesnap-editor-code-scroll';
    scroller.dataset.codeFormat = format;
    const pre = document.createElement('pre');
    pre.className = 'tablesnap-editor-code-preview';
    const codeNode = document.createElement('code');
    codeNode.append(tokenizedCode(format, code, codeSearch));
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

  function enterCodePreview(editor) {
    if (!editor?.isConnected || !CODE_FORMATS.has(currentFormat())) return;
    codeMode = false;
    codeSearch = '';
    setSearch(editor, '', true);
    const snapshot = readCurrentTable(editor);
    if (snapshot) cachedTable = snapshot;
    codeMode = true;
    renderCode(editor);
  }

  function leaveCodePreview(editor) {
    if (!editor?.isConnected) return;
    codeMode = false;
    codeSearch = '';
    editor.querySelectorAll('[data-output-preview-toggle]').forEach((toggle) => toggle.remove());
    setHeader(editor, false);
    setSearch(editor, '', true);
  }

  function handleFormatChange() {
    if (!activeEditor?.isConnected) return;
    const format = currentFormat();
    if (CODE_FORMATS.has(format)) {
      if (!codeMode) enterCodePreview(activeEditor);
      else renderCode(activeEditor);
    } else if (codeMode || activeEditor.querySelector('[data-output-preview-toggle]')) {
      leaveCodePreview(activeEditor);
    }
  }

  function handleSearch(event) {
    if (bypassSearchInterception || !codeMode || !CODE_FORMATS.has(currentFormat())) return;
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
      if (renderingCode || !codeMode || !CODE_FORMATS.has(currentFormat())) return;
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
    if (CODE_FORMATS.has(currentFormat())) enterCodePreview(editor);
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
    if (codeMode && CODE_FORMATS.has(currentFormat())) renderCode(activeEditor);
  });
  document.addEventListener('input', handleSearch, true);

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
