(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

  let activeEditor = null;
  let previewObserver = null;
  let state = createDefaultState();

  function slugify(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'table';
  }

  function defaultFilename() {
    const title = document.title?.trim() || 'table';
    return `table-${slugify(title)}`;
  }

  function createDefaultState() {
    return {
      preserveLinks: true,
      keepOriginalFormatting: true,
      filename: defaultFilename(),
      includeHeaders: true
    };
  }

  function dispatchStateChange() {
    document.dispatchEvent(new CustomEvent('tablesnap:editor-settings-change', {
      detail: { ...state }
    }));
  }

  function findSection(editor, title) {
    return [...editor.querySelectorAll('.tablesnap-editor-section')].find((section) => {
      return section.querySelector('.tablesnap-editor-section-head strong')?.textContent?.trim() === title;
    }) || null;
  }

  function createToggle(title, description, checked, onChange) {
    const label = document.createElement('label');
    label.className = 'tablesnap-editor-extra-option';

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-extra-copy';
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

  function renderContentSection(editor) {
    const section = findSection(editor, 'Content');
    if (!section) return;

    section.classList.add('tablesnap-editor-content-section');
    section.querySelector('.tablesnap-editor-section-placeholder')?.remove();

    let panel = section.querySelector('[data-content-settings]');
    if (!panel) {
      panel = document.createElement('div');
      panel.dataset.contentSettings = 'true';
      panel.className = 'tablesnap-editor-extra-options';
      section.append(panel);
    }

    panel.replaceChildren(
      createToggle('Preserve links (URLs)', 'Keep detected URL text clickable', state.preserveLinks, (checked) => {
        state.preserveLinks = checked;
        applyPreviewContent(editor);
        dispatchStateChange();
      }),
      createToggle('Keep original formatting', 'Preserve multiline cell formatting', state.keepOriginalFormatting, (checked) => {
        state.keepOriginalFormatting = checked;
        applyPreviewContent(editor);
        dispatchStateChange();
      })
    );
  }

  function sanitizeFilename(value) {
    return String(value || '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+|\.+$/g, '')
      .trim()
      .slice(0, 120);
  }

  function renderFileSection(editor) {
    const section = findSection(editor, 'File Settings');
    if (!section) return;

    section.classList.add('tablesnap-editor-file-section');
    section.querySelector('.tablesnap-editor-section-placeholder')?.remove();

    let panel = section.querySelector('[data-file-settings]');
    if (!panel) {
      panel = document.createElement('div');
      panel.dataset.fileSettings = 'true';
      panel.className = 'tablesnap-editor-file-settings';
      section.append(panel);
    }

    panel.replaceChildren();

    const filenameField = document.createElement('label');
    filenameField.className = 'tablesnap-editor-filename-field';
    const filenameLabel = document.createElement('span');
    filenameLabel.textContent = 'Filename';
    const filenameControl = document.createElement('div');
    filenameControl.className = 'tablesnap-editor-filename-control';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = state.filename;
    input.placeholder = 'table-export';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Export filename');
    const extension = document.createElement('span');
    extension.className = 'tablesnap-editor-filename-extension';
    extension.textContent = '.csv';
    filenameControl.append(input, extension);
    filenameField.append(filenameLabel, filenameControl);

    input.addEventListener('input', () => {
      state.filename = sanitizeFilename(input.value);
      dispatchStateChange();
    });
    input.addEventListener('blur', () => {
      const safe = sanitizeFilename(input.value) || defaultFilename();
      state.filename = safe;
      input.value = safe;
      dispatchStateChange();
    });

    const headerToggle = createToggle(
      'Include column headers',
      'Include renamed headers in copied/exported output',
      state.includeHeaders,
      (checked) => {
        state.includeHeaders = checked;
        dispatchStateChange();
      }
    );

    const note = document.createElement('div');
    note.className = 'tablesnap-editor-file-note';
    note.textContent = 'Filename extension follows the selected export format.';

    panel.append(filenameField, headerToggle, note);
  }

  function linkifyCell(cell) {
    if (cell.dataset.tablesnapLinked === 'true') return;
    const text = cell.textContent || '';
    URL_PATTERN.lastIndex = 0;
    let match;
    let lastIndex = 0;
    let found = false;
    const fragment = document.createDocumentFragment();

    while ((match = URL_PATTERN.exec(text))) {
      found = true;
      const raw = match[0];
      const trailing = raw.match(/[),.;!?]+$/)?.[0] || '';
      const url = trailing ? raw.slice(0, -trailing.length) : raw;
      if (match.index > lastIndex) fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'tablesnap-editor-preview-link';
      fragment.append(anchor);
      if (trailing) fragment.append(document.createTextNode(trailing));
      lastIndex = match.index + raw.length;
    }

    if (!found) return;
    if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)));
    cell.replaceChildren(fragment);
    cell.dataset.tablesnapLinked = 'true';
  }

  function applyPreviewContent(editor) {
    if (!editor?.isConnected) return;
    editor.dataset.keepOriginalFormatting = String(state.keepOriginalFormatting);
    editor.dataset.preserveLinks = String(state.preserveLinks);

    const cells = editor.querySelectorAll('.tablesnap-editor-data-table tbody td:not(.tablesnap-editor-select-cell)');
    cells.forEach((cell) => {
      if (state.preserveLinks) linkifyCell(cell);
    });
  }

  function injectStyles(editor) {
    if (editor.querySelector('[data-tablesnap-extra-settings-style]')) return;
    const style = document.createElement('style');
    style.dataset.tablesnapExtraSettingsStyle = 'true';
    style.textContent = `
      .tablesnap-editor-extra-options{display:grid;margin-top:8px}
      .tablesnap-editor-extra-option{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;cursor:pointer}
      .tablesnap-editor-extra-copy{min-width:0;display:block}
      .tablesnap-editor-extra-copy strong{display:block;font-size:10.5px;font-weight:600;color:#404040}
      .tablesnap-editor-extra-copy span{display:block;margin-top:2px;font-size:8.5px;line-height:1.25;color:#90959b}
      .tablesnap-editor-file-settings{display:grid;gap:10px;margin-top:10px}
      .tablesnap-editor-filename-field>span{display:block;margin-bottom:5px;font-size:9px;font-weight:600;color:#61676d}
      .tablesnap-editor-filename-control{height:32px;display:flex;align-items:center;overflow:hidden;border:1px solid #dfe3e8;border-radius:7px;background:#fff}
      .tablesnap-editor-filename-control:focus-within{border-color:var(--ts-accent,#2563eb);box-shadow:0 0 0 2px color-mix(in srgb,var(--ts-accent,#2563eb) 12%,transparent)}
      .tablesnap-editor-filename-control input{min-width:0;flex:1;height:30px;margin:0;padding:0 8px;border:0!important;outline:0!important;background:transparent!important;color:#34383d!important;font-size:10px!important;box-shadow:none!important}
      .tablesnap-editor-filename-extension{height:100%;display:flex;align-items:center;padding:0 8px;border-left:1px solid #e6e8eb;background:#f8f9fa;font-size:9px;font-weight:600;color:#8a9097}
      .tablesnap-editor-file-note{font-size:8.5px;line-height:1.3;color:#9a9fa5}
      .tablesnap-editor-preview-link{color:var(--ts-accent,#2563eb)!important;text-decoration:underline!important;text-underline-offset:2px!important}
      .tablesnap-table-editor[data-keep-original-formatting="false"] .tablesnap-editor-data-table td:not(.tablesnap-editor-select-cell){white-space:normal!important}
    `;
    editor.append(style);
  }

  function observePreview(editor) {
    previewObserver?.disconnect();
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;
    previewObserver = new MutationObserver(() => applyPreviewContent(editor));
    previewObserver.observe(preview, { childList: true, subtree: true });
  }

  function setupEditor(editor) {
    if (!editor || editor.dataset.contentFileSettingsReady === 'true') return;
    editor.dataset.contentFileSettingsReady = 'true';
    activeEditor = editor;
    state = createDefaultState();
    injectStyles(editor);
    renderContentSection(editor);
    renderFileSection(editor);
    observePreview(editor);
    applyPreviewContent(editor);
    dispatchStateChange();
  }

  function scan() {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (editor) setupEditor(editor);
    if (!editor && activeEditor) {
      previewObserver?.disconnect();
      previewObserver = null;
      activeEditor = null;
      state = createDefaultState();
    }
  }

  window.__TableSnapEditorSettings = {
    getState() {
      return { ...state };
    },
    getFilename(extension = '') {
      const suffix = extension ? `.${String(extension).replace(/^\./, '')}` : '';
      return `${state.filename || defaultFilename()}${suffix}`;
    },
    setExtension(extension) {
      const label = activeEditor?.querySelector('.tablesnap-editor-filename-extension');
      if (label) label.textContent = `.${String(extension || 'csv').replace(/^\./, '')}`;
    }
  };

  const contentFileSettingsObserver = new MutationObserver(scan);
  contentFileSettingsObserver.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
