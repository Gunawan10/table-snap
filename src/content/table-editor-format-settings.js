(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const FORMATS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'xlsx', label: 'Excel', extension: 'xlsx' },
    { id: 'json', label: 'JSON', extension: 'json' },
    { id: 'markdown', label: 'Markdown', extension: 'md' },
    { id: 'png', label: 'PNG', extension: 'png' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
    { id: 'tsv', label: 'TSV', extension: 'tsv' },
    { id: 'html', label: 'HTML', extension: 'html' },
    { id: 'sql', label: 'SQL', extension: 'sql' },
    { id: 'ndjson', label: 'NDJSON', extension: 'ndjson' }
  ];

  const FORMAT_ICONS = {
    xlsx: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="11" height="18" rx="1.5" fill="currentColor" stroke="none"/><path d="M8 8.5l3 6M11 8.5l-3 6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M15 6h5v12h-5M15 10h5M15 14h5M17.5 6v12"/></svg>',
    csv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5zM14 3v5h5"/><path d="M8 12h8M8 15h8M8 18h5"/></svg>',
    json: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4a2 2 0 0 0-2 2v3c0 1.7-.7 3-2 3 1.3 0 2 1.3 2 3v3a2 2 0 0 0 2 2M16 4a2 2 0 0 1 2 2v3c0 1.7.7 3 2 3-1.3 0-2 1.3-2 3v3a2 2 0 0 1-2 2"/></svg>',
    markdown: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15V9l2.5 2.5L12 9v6M15 12l2 2 2-2M17 14V9"/></svg>',
    png: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="15.5" cy="8.5" r="1"/><path d="m3 17 5-5 4 4 2-2 7 7"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5zM14 3v5h5"/><path d="M8 16v-5h2a1.5 1.5 0 0 1 0 3H8M13 11v5h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1M18 16v-5h3M18 13h2"/></svg>',
    tsv: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>',
    sql: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    ndjson: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5zM14 3v5h5"/><path d="M8 12h2M8 15h5M8 18h7"/></svg>'
  };

  const DEFAULT_OPTIONS = {
    json: { prettyPrint: true, indentation: 2, headersAsKeys: true, includeEmptyValues: true },
    sql: { tableName: 'table_data', dialect: 'mysql', includeColumnNames: true, quoteIdentifiers: true, nullEmptyValues: false, multiRowInsert: false },
    ndjson: { headersAsKeys: true, skipEmptyValues: false },
    html: { includeHeaders: true, basicStyling: false, semanticHtml: true, minify: false, tableAttributes: '' }
  };

  const FORMAT_SETTINGS_FORMATS = new Set(['json', 'html', 'sql', 'ndjson']);

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

    const hasSettings = FORMAT_SETTINGS_FORMATS.has(format);
    section.hidden = !hasSettings;
    section.style.setProperty('display', hasSettings ? '' : 'none', hasSettings ? '' : 'important');
    if (!hasSettings) return;

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
  }

  function updateFormatControl(label, meta) {
    const icon = label.querySelector('[data-format-icon]');
    if (icon) {
      icon.dataset.format = meta.id;
      icon.setAttribute('aria-label', `${meta.label} format`);
      icon.innerHTML = FORMAT_ICONS[meta.id] || FORMAT_ICONS.csv;
    }
  }

  function decorateActionButtons(editor) {
    const copyButton = editor.querySelector('.tablesnap-editor-secondary');
    const exportButton = editor.querySelector('.tablesnap-editor-primary');
    if (copyButton && copyButton.dataset.iconReady !== 'true') {
      copyButton.dataset.iconReady = 'true';
      copyButton.innerHTML = '<svg class="tablesnap-editor-action-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Copy</span>';
    }
    if (exportButton && exportButton.dataset.iconReady !== 'true') {
      exportButton.dataset.iconReady = 'true';
      exportButton.innerHTML = '<svg class="tablesnap-editor-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/></svg><span>Export</span>';
    }
  }

  function setupFormatSelect(editor) {
    const label = editor.querySelector('.tablesnap-editor-format');
    const select = label?.querySelector('select');
    if (!label || !select) return;

    select.disabled = false;
    select.replaceChildren();
    FORMATS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.label} (.${item.extension})`;
      option.selected = item.id === format;
      select.append(option);
    });

    if (!label.querySelector('.tablesnap-editor-format-control')) {
      const control = document.createElement('span');
      control.className = 'tablesnap-editor-format-control';
      const icon = document.createElement('span');
      icon.className = 'tablesnap-editor-format-icon';
      icon.dataset.formatIcon = 'true';
      const chevron = document.createElement('svg');
      chevron.className = 'tablesnap-editor-format-chevron';
      chevron.setAttribute('viewBox', '0 0 20 20');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML = '<path d="m6.5 8 3.5 3.5L13.5 8"/>';
      control.append(icon, select, chevron);
      label.append(control);
    }

    const sync = () => {
      format = select.value;
      const meta = FORMATS.find((item) => item.id === format) || FORMATS[0];
      updateFormatControl(label, meta);
      window.__TableSnapEditorSettings?.setExtension?.(meta.extension);
      renderFormatPanel(editor);
      dispatchChange();
    };

    updateFormatControl(label, FORMATS.find((item) => item.id === format) || FORMATS[0]);
    select.addEventListener('change', sync);
  }

  function setupEditor(editor) {
    if (!editor || editor.dataset.formatSettingsReady === 'true') return;
    editor.dataset.formatSettingsReady = 'true';
    activeEditor = editor;
    format = 'csv';
    options = cloneOptions();
    decorateActionButtons(editor);
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
