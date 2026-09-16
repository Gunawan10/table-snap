(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const FORMATS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'xlsx', label: 'XLSX', extension: 'xlsx' },
    { id: 'json', label: 'JSON', extension: 'json' },
    { id: 'markdown', label: 'Markdown', extension: 'md' },
    { id: 'png', label: 'PNG', extension: 'png' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
    { id: 'tsv', label: 'TSV', extension: 'tsv' },
    { id: 'html', label: 'HTML', extension: 'html' },
    { id: 'sql', label: 'SQL', extension: 'sql' },
    { id: 'ndjson', label: 'NDJSON', extension: 'ndjson' }
  ];

  const DEFAULT_OPTIONS = {
    json: { prettyPrint: true, indentation: 2, headersAsKeys: true, includeEmptyValues: true },
    sql: { tableName: 'table_data', dialect: 'mysql', includeColumnNames: true, quoteIdentifiers: true, nullEmptyValues: false, multiRowInsert: false },
    ndjson: { headersAsKeys: true, skipEmptyValues: false },
    html: { includeHeaders: true, basicStyling: false, semanticHtml: true, minify: false, tableAttributes: '' }
  };

  let activeEditor = null;
  let format = 'csv';
  let options = cloneOptions();

  function cloneOptions() {
    return Object.fromEntries(Object.entries(DEFAULT_OPTIONS).map(([key, value]) => [key, { ...value }]));
  }

  function findFormatSection(editor) {
    return [...editor.querySelectorAll('.tablesnap-editor-section')].find((section) => {
      return section.querySelector('.tablesnap-editor-section-head strong')?.textContent?.trim() === 'Format Settings';
    }) || null;
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent('tablesnap:editor-format-change', {
      detail: { format, options: structuredClone(options) }
    }));
  }

  function createToggle(title, description, checked, onChange) {
    const label = document.createElement('label');
    label.className = 'tablesnap-editor-format-option';

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-format-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('span');
    small.textContent = description;
    copy.append(strong, small);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'tablesnap-editor-checkbox';
    input.checked = checked;
    input.setAttribute('aria-label', title);
    input.addEventListener('change', () => onChange(input.checked));
    label.append(copy, input);
    return label;
  }

  function createSelectField(labelText, value, choices, onChange) {
    const label = document.createElement('label');
    label.className = 'tablesnap-editor-format-field';
    const title = document.createElement('span');
    title.textContent = labelText;
    const select = document.createElement('select');
    choices.forEach(([choiceValue, choiceLabel]) => {
      const option = document.createElement('option');
      option.value = choiceValue;
      option.textContent = choiceLabel;
      option.selected = String(value) === String(choiceValue);
      select.append(option);
    });
    select.addEventListener('change', () => onChange(select.value));
    label.append(title, select);
    return label;
  }

  function createTextField(labelText, value, placeholder, onChange) {
    const label = document.createElement('label');
    label.className = 'tablesnap-editor-format-field';
    const title = document.createElement('span');
    title.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder || '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => onChange(input.value));
    label.append(title, input);
    return label;
  }

  function updateOption(group, key, value) {
    options[group][key] = value;
    dispatchChange();
  }

  function renderJson(panel) {
    const state = options.json;
    panel.append(
      createToggle('Pretty print', 'Indent JSON for easier reading', state.prettyPrint, (value) => updateOption('json', 'prettyPrint', value)),
      createSelectField('Indentation', state.indentation, [['2', '2 spaces'], ['4', '4 spaces']], (value) => updateOption('json', 'indentation', Number(value))),
      createToggle('Use headers as keys', 'Build object keys from column headers', state.headersAsKeys, (value) => updateOption('json', 'headersAsKeys', value)),
      createToggle('Include empty values', 'Keep properties with empty cell values', state.includeEmptyValues, (value) => updateOption('json', 'includeEmptyValues', value))
    );
  }

  function renderSql(panel) {
    const state = options.sql;
    panel.append(
      createTextField('Table name', state.tableName, 'table_data', (value) => updateOption('sql', 'tableName', value || 'table_data')),
      createSelectField('Dialect', state.dialect, [['mysql', 'MySQL'], ['postgresql', 'PostgreSQL'], ['sqlite', 'SQLite']], (value) => updateOption('sql', 'dialect', value)),
      createToggle('Include column names', 'Write column names in INSERT statements', state.includeColumnNames, (value) => updateOption('sql', 'includeColumnNames', value)),
      createToggle('Quote identifiers', 'Quote table and column identifiers', state.quoteIdentifiers, (value) => updateOption('sql', 'quoteIdentifiers', value)),
      createToggle('NULL for empty cells', 'Export empty values as SQL NULL', state.nullEmptyValues, (value) => updateOption('sql', 'nullEmptyValues', value)),
      createToggle('Multi-row INSERT', 'Combine rows into fewer INSERT statements', state.multiRowInsert, (value) => updateOption('sql', 'multiRowInsert', value))
    );
  }

  function renderNdjson(panel) {
    const state = options.ndjson;
    panel.append(
      createToggle('Use headers as keys', 'Build object keys from column headers', state.headersAsKeys, (value) => updateOption('ndjson', 'headersAsKeys', value)),
      createToggle('Skip empty values', 'Omit properties with empty cell values', state.skipEmptyValues, (value) => updateOption('ndjson', 'skipEmptyValues', value))
    );
  }

  function renderHtml(panel) {
    const state = options.html;
    panel.append(
      createToggle('Include headers', 'Render column headers in the table', state.includeHeaders, (value) => updateOption('html', 'includeHeaders', value)),
      createToggle('Basic styling', 'Add simple readable table styles', state.basicStyling, (value) => updateOption('html', 'basicStyling', value)),
      createToggle('Semantic HTML', 'Use thead, tbody, th, and td elements', state.semanticHtml, (value) => updateOption('html', 'semanticHtml', value)),
      createToggle('Minify HTML', 'Remove unnecessary whitespace', state.minify, (value) => updateOption('html', 'minify', value)),
      createTextField('Table attributes', state.tableAttributes, 'class="table"', (value) => updateOption('html', 'tableAttributes', value))
    );
  }

  function renderFormatPanel(editor) {
    const section = findFormatSection(editor);
    if (!section) return;
    section.classList.add('tablesnap-editor-format-section');
    section.querySelector('.tablesnap-editor-section-placeholder')?.remove();

    let panel = section.querySelector('[data-format-settings-panel]');
    if (!panel) {
      panel = document.createElement('div');
      panel.dataset.formatSettingsPanel = 'true';
      panel.className = 'tablesnap-editor-format-settings-panel';
      section.append(panel);
    }
    panel.replaceChildren();

    if (format === 'json') renderJson(panel);
    else if (format === 'sql') renderSql(panel);
    else if (format === 'ndjson') renderNdjson(panel);
    else if (format === 'html') renderHtml(panel);
    else {
      const empty = document.createElement('div');
      empty.className = 'tablesnap-editor-format-empty';
      empty.textContent = 'No extra settings for this format.';
      panel.append(empty);
    }
  }

  function setupFormatSelect(editor) {
    const select = editor.querySelector('.tablesnap-editor-format select');
    if (!select) return;
    select.disabled = false;
    select.replaceChildren();
    FORMATS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      option.selected = item.id === format;
      select.append(option);
    });

    select.addEventListener('change', () => {
      format = select.value;
      const meta = FORMATS.find((item) => item.id === format) || FORMATS[0];
      window.__TableSnapEditorSettings?.setExtension?.(meta.extension);
      renderFormatPanel(editor);
      dispatchChange();
    });
  }

  function setupEditor(editor) {
    if (!editor || editor.dataset.formatSettingsReady === 'true') return;
    editor.dataset.formatSettingsReady = 'true';
    activeEditor = editor;
    format = 'csv';
    options = cloneOptions();
    setupFormatSelect(editor);
    renderFormatPanel(editor);
    window.__TableSnapEditorSettings?.setExtension?.('csv');
    dispatchChange();
  }

  function scan() {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (editor) setupEditor(editor);
    if (!editor && activeEditor) {
      activeEditor = null;
      format = 'csv';
      options = cloneOptions();
    }
  }

  window.__TableSnapEditorFormatSettings = {
    getFormat() { return format; },
    getOptions(targetFormat = format) { return { ...(options[targetFormat] || {}) }; },
    getState() { return { format, options: structuredClone(options) }; },
    getMeta(targetFormat = format) { return { ...(FORMATS.find((item) => item.id === targetFormat) || FORMATS[0]) }; }
  };

  const formatSettingsObserver = new MutationObserver(scan);
  formatSettingsObserver.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
