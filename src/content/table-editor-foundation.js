(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SOURCE_CARD_SELECTOR = '.tablesnap-export-card, .tablesnap-modern-export-card';
  const DEFAULT_CLEANUP = Object.freeze({
    trimWhitespace: false,
    collapseSpaces: false,
    normalizeLineBreaks: false,
    removeEmptyRows: false,
    removeEmptyColumns: false,
    removeDuplicateRows: false
  });

  let editor = null;
  let sourceCard = null;
  let sourceIcon = null;
  let sourceTarget = null;
  let sourceType = null;
  let suppressIconHandling = false;
  let capturedSnapshot = { headers: [], rows: [] };
  let selectedRows = new Set();
  let searchQuery = '';
  let columns = [];
  let editingColumnId = null;
  let draggingColumnId = null;
  let cleanup = { ...DEFAULT_CLEANUP };

  function closeEditorOnly() {
    editor?.remove();
    editor = null;
    sourceCard = null;
    sourceIcon = null;
    sourceTarget = null;
    sourceType = null;
    capturedSnapshot = { headers: [], rows: [] };
    selectedRows = new Set();
    searchQuery = '';
    columns = [];
    editingColumnId = null;
    draggingColumnId = null;
    cleanup = { ...DEFAULT_CLEANUP };
    document.documentElement.classList.remove('tablesnap-editor-open');
  }

  function closeThroughSourceIcon() {
    if (!editor) return;
    const icon = sourceIcon;
    if (icon?.isConnected) {
      suppressIconHandling = true;
      icon.click();
      suppressIconHandling = false;
      return;
    }
    sourceCard?.remove();
    closeEditorOnly();
  }

  function createPlaceholderSection(title, description) {
    return `
      <section class="tablesnap-editor-section">
        <div class="tablesnap-editor-section-head">
          <strong>${title}</strong>
          <span>${description}</span>
        </div>
        <div class="tablesnap-editor-section-placeholder" aria-hidden="true">
          <span></span><span></span>
        </div>
      </section>`;
  }

  function createEditor() {
    const root = document.createElement('div');
    root.className = 'tablesnap-table-editor';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Table Editor');
    root.innerHTML = `
      <div class="tablesnap-editor-backdrop" data-editor-close></div>
      <div class="tablesnap-editor-dialog">
        <header class="tablesnap-editor-header">
          <div class="tablesnap-editor-heading">
            <div class="tablesnap-editor-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 5.5h16v13H4zM4 10h16M9 5.5v13"/></svg>
            </div>
            <div>
              <strong>Table Editor</strong>
              <span>Clean and prepare your table before export</span>
            </div>
          </div>
          <button type="button" class="tablesnap-editor-close" data-editor-close aria-label="Close Table Editor">
            <svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>
          </button>
        </header>

        <div class="tablesnap-editor-body">
          <main class="tablesnap-editor-workspace">
            <div class="tablesnap-editor-workspace-head">
              <div>
                <div class="tablesnap-editor-preview-title-row">
                  <strong>Table Preview</strong>
                  <span class="tablesnap-editor-table-count" data-table-count></span>
                </div>
              </div>
              <label class="tablesnap-editor-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
                <input type="search" data-table-search placeholder="Search in table..." autocomplete="off" spellcheck="false">
              </label>
            </div>
            <div class="tablesnap-editor-preview" data-table-preview></div>
          </main>

          <aside class="tablesnap-editor-sidebar">
            <section class="tablesnap-editor-section tablesnap-editor-columns-section">
              <div class="tablesnap-editor-section-head">
                <strong>Columns</strong>
                <span>Show, rename, and reorder</span>
              </div>
              <div class="tablesnap-editor-columns" data-columns-panel></div>
            </section>
            <section class="tablesnap-editor-section tablesnap-editor-cleanup-section">
              <div class="tablesnap-editor-section-head tablesnap-editor-cleanup-head">
                <div>
                  <strong>Data Cleanup</strong>
                  <span>Clean captured values</span>
                </div>
                <button type="button" class="tablesnap-editor-reset-cleanup" data-cleanup-reset>Reset</button>
              </div>
              <div class="tablesnap-editor-cleanup-options" data-cleanup-panel></div>
            </section>
            ${createPlaceholderSection('Content', 'Links and formatting')}
            ${createPlaceholderSection('File Settings', 'Filename and headers')}
            ${createPlaceholderSection('Format Settings', 'Options for the selected format')}
          </aside>
        </div>

        <footer class="tablesnap-editor-footer">
          <div class="tablesnap-editor-selection-summary" data-selection-count></div>
          <div class="tablesnap-editor-footer-actions">
            <label class="tablesnap-editor-format">
              <span>Format</span>
              <select disabled aria-label="Export format"><option>CSV</option></select>
            </label>
            <button type="button" class="tablesnap-editor-secondary" disabled>Copy</button>
            <button type="button" class="tablesnap-editor-primary" disabled>Export</button>
          </div>
        </footer>
      </div>`;

    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-editor-close]')) closeThroughSourceIcon();
    });
    root.querySelector('[data-table-search]')?.addEventListener('input', (event) => {
      searchQuery = event.target.value.trim().toLocaleLowerCase();
      renderPreview();
    });
    root.querySelector('[data-cleanup-reset]')?.addEventListener('click', () => {
      cleanup = { ...DEFAULT_CLEANUP };
      renderCleanupPanel();
      renderColumnsPanel();
      renderPreview();
    });
    return root;
  }

  function distanceToTarget(icon, target) {
    const iconRect = icon.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const vertical = Math.abs(iconRect.top - (targetRect.top + 8));
    const left = Math.abs(iconRect.left - (targetRect.left + 8));
    const right = Math.abs(iconRect.right - (targetRect.right - 8));
    return vertical + Math.min(left, right);
  }

  function nearestTarget(icon, candidates) {
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (!(candidate instanceof Element) || !candidate.isConnected) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width <= 24 || rect.height <= 24) continue;
      const score = distanceToTarget(icon, candidate);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return bestScore <= 80 ? best : null;
  }

  function resolveTargetFromIcon(icon) {
    if (!icon) return { target: null, type: null };
    if (icon.dataset.tablesnapModern === 'true' && window.__TableSnapModern?.getModernType) {
      const candidates = [...document.querySelectorAll('[role="table"], [role="grid"], [role="treegrid"], div, section')]
        .filter((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const iconRect = icon.getBoundingClientRect();
          return Math.abs(rect.top - iconRect.top) <= 64 && Boolean(window.__TableSnapModern.getModernType(candidate));
        });
      return { target: nearestTarget(icon, candidates), type: 'modern' };
    }
    return { target: nearestTarget(icon, [...document.querySelectorAll('table')]), type: 'native' };
  }

  function parseSourceTarget() {
    if (!sourceTarget) return { headers: [], rows: [] };
    try {
      if (sourceType === 'modern') {
        return window.__TableSnapModern?.parseModernTable?.(sourceTarget) || { headers: [], rows: [] };
      }
      return window.__TableSnapCore?.parseTable?.(sourceTarget) || { headers: [], rows: [] };
    } catch (error) {
      console.error('[TableSnap] Table Editor preview failed:', error);
      return { headers: [], rows: [] };
    }
  }

  function normalizedSnapshot(value) {
    const headers = Array.isArray(value?.headers) ? value.headers.map((cell) => String(cell ?? '')) : [];
    const rows = Array.isArray(value?.rows)
      ? value.rows.map((row) => headers.map((_, column) => String(row?.[column] ?? '')))
      : [];
    return { headers, rows };
  }

  function initializeColumns() {
    columns = capturedSnapshot.headers.map((header, sourceIndex) => ({
      id: `column-${sourceIndex}`,
      sourceIndex,
      label: header || `Column ${sourceIndex + 1}`,
      visible: true
    }));
  }

  function cleanupValue(value) {
    let text = String(value ?? '');
    if (cleanup.normalizeLineBreaks) {
      text = text.replace(/\r\n?/g, '\n').replace(/[ \t]*\n[ \t]*/g, '\n');
    }
    if (cleanup.collapseSpaces) text = text.replace(/[ \t]+/g, ' ');
    if (cleanup.trimWhitespace) text = text.trim();
    return text;
  }

  function transformedHeaders() {
    return capturedSnapshot.headers.map(cleanupValue);
  }

  function transformedRows() {
    let result = capturedSnapshot.rows.map((row, sourceRowIndex) => ({
      sourceRowIndex,
      values: row.map(cleanupValue)
    }));
    if (cleanup.removeEmptyRows) {
      result = result.filter((row) => row.values.some((value) => value.trim() !== ''));
    }
    if (cleanup.removeDuplicateRows) {
      const seen = new Set();
      result = result.filter((row) => {
        const key = JSON.stringify(row.values);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return result;
  }

  function effectiveColumnSourceIndexes(rows = transformedRows()) {
    if (!cleanup.removeEmptyColumns || !capturedSnapshot.headers.length || !rows.length) {
      return capturedSnapshot.headers.map((_, index) => index);
    }
    return capturedSnapshot.headers
      .map((_, index) => index)
      .filter((index) => rows.some((row) => String(row.values[index] ?? '').trim() !== ''));
  }

  function effectiveColumns(rows = transformedRows()) {
    const allowed = new Set(effectiveColumnSourceIndexes(rows));
    return columns.filter((column) => column.visible && allowed.has(column.sourceIndex));
  }

  function visibleRowRecords() {
    const rows = transformedRows();
    if (!searchQuery) return rows;
    const searchable = effectiveColumns(rows);
    return rows.filter((row) => {
      const values = searchable.length ? searchable.map((column) => row.values[column.sourceIndex]) : row.values;
      return values.join('\n').toLocaleLowerCase().includes(searchQuery);
    });
  }

  function selectedEffectiveCount(rows = transformedRows()) {
    return rows.reduce((count, row) => count + (selectedRows.has(row.sourceRowIndex) ? 1 : 0), 0);
  }

  function setCheckboxState(checkbox, checked, indeterminate = false) {
    checkbox.checked = checked;
    checkbox.indeterminate = indeterminate;
  }

  function createCheckbox(label, checked, onChange) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'tablesnap-editor-checkbox';
    input.setAttribute('aria-label', label);
    input.checked = checked;
    input.addEventListener('change', onChange);
    return input;
  }

  function renderEmpty(preview, title, description) {
    const empty = document.createElement('div');
    empty.className = 'tablesnap-editor-preview-empty';
    empty.innerHTML = '<div class="tablesnap-editor-preview-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg></div>';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const span = document.createElement('span');
    span.textContent = description;
    empty.append(strong, span);
    preview.append(empty);
  }

  function updateCounters(visibleRows, allRows, shownColumns, totalEffectiveColumns) {
    if (!editor) return;
    const count = editor.querySelector('[data-table-count]');
    const selection = editor.querySelector('[data-selection-count]');
    const rowText = searchQuery && visibleRows.length !== allRows.length
      ? `${visibleRows.length} of ${allRows.length} rows`
      : `${allRows.length} rows`;
    const columnText = shownColumns.length === totalEffectiveColumns
      ? `${shownColumns.length} columns`
      : `${shownColumns.length} of ${totalEffectiveColumns} columns`;
    if (count) count.textContent = `${rowText} × ${columnText}`;
    if (selection) {
      const selected = selectedEffectiveCount(allRows);
      selection.textContent = `${selected} of ${allRows.length} row${allRows.length === 1 ? '' : 's'} selected`;
      selection.dataset.active = String(selected > 0);
    }
  }

  function renderPreview() {
    if (!editor) return;
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;
    preview.replaceChildren();

    const allRows = transformedRows();
    const visibleRows = visibleRowRecords();
    const effectiveSourceIndexes = effectiveColumnSourceIndexes(allRows);
    const shownColumns = effectiveColumns(allRows);
    updateCounters(visibleRows, allRows, shownColumns, effectiveSourceIndexes.length);

    if (!capturedSnapshot.headers.length) {
      renderEmpty(preview, 'No table data found', 'TableSnap could not create a structured preview for this table.');
      return;
    }
    if (!shownColumns.length) {
      renderEmpty(preview, 'No columns selected', 'Enable at least one non-empty column from the Columns panel.');
      return;
    }
    if (!visibleRows.length) {
      renderEmpty(
        preview,
        searchQuery ? 'No matching rows' : 'No rows remaining',
        searchQuery ? 'Try a different search term.' : 'Adjust the cleanup options to restore rows.'
      );
      return;
    }

    const headers = transformedHeaders();
    const scroller = document.createElement('div');
    scroller.className = 'tablesnap-editor-table-scroll';
    const table = document.createElement('table');
    table.className = 'tablesnap-editor-data-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const selectHead = document.createElement('th');
    selectHead.className = 'tablesnap-editor-select-cell';
    const selectedCount = selectedEffectiveCount(allRows);
    const selectAll = createCheckbox('Select all rows', false, () => {
      if (selectAll.checked) allRows.forEach((row) => selectedRows.add(row.sourceRowIndex));
      else allRows.forEach((row) => selectedRows.delete(row.sourceRowIndex));
      renderPreview();
    });
    setCheckboxState(
      selectAll,
      selectedCount === allRows.length && allRows.length > 0,
      selectedCount > 0 && selectedCount < allRows.length
    );
    selectHead.append(selectAll);
    headerRow.append(selectHead);

    shownColumns.forEach((column) => {
      const th = document.createElement('th');
      th.textContent = column.label === capturedSnapshot.headers[column.sourceIndex]
        ? (headers[column.sourceIndex] || column.label)
        : column.label;
      headerRow.append(th);
    });
    thead.append(headerRow);

    const tbody = document.createElement('tbody');
    visibleRows.forEach((rowRecord) => {
      const rowIndex = rowRecord.sourceRowIndex;
      const tr = document.createElement('tr');
      if (selectedRows.has(rowIndex)) tr.dataset.selected = 'true';
      const selectCell = document.createElement('td');
      selectCell.className = 'tablesnap-editor-select-cell';
      const checkbox = createCheckbox(`Select row ${rowIndex + 1}`, selectedRows.has(rowIndex), () => {
        if (checkbox.checked) selectedRows.add(rowIndex);
        else selectedRows.delete(rowIndex);
        renderPreview();
      });
      selectCell.append(checkbox);
      tr.append(selectCell);
      shownColumns.forEach((column) => {
        const value = rowRecord.values[column.sourceIndex] ?? '';
        const td = document.createElement('td');
        td.textContent = value;
        td.title = value.replace(/\s+/g, ' ').trim();
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    scroller.append(table);
    preview.append(scroller);
  }

  function iconButton(label, svg) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablesnap-editor-column-icon';
    button.setAttribute('aria-label', label);
    button.innerHTML = svg;
    return button;
  }

  function commitColumnRename(column, input) {
    const next = input.value.trim();
    if (next) column.label = next;
    editingColumnId = null;
    renderColumnsPanel();
    renderPreview();
  }

  function renderColumnsPanel() {
    if (!editor) return;
    const panel = editor.querySelector('[data-columns-panel]');
    if (!panel) return;
    panel.replaceChildren();

    const effective = new Set(effectiveColumnSourceIndexes());
    columns.forEach((column) => {
      const row = document.createElement('div');
      row.className = 'tablesnap-editor-column-row';
      row.dataset.columnId = column.id;
      if (!column.visible) row.dataset.hidden = 'true';
      if (!effective.has(column.sourceIndex)) row.dataset.cleaned = 'true';
      if (draggingColumnId === column.id) row.dataset.dragging = 'true';

      const drag = document.createElement('span');
      drag.className = 'tablesnap-editor-column-drag';
      drag.draggable = editingColumnId !== column.id;
      drag.setAttribute('role', 'button');
      drag.setAttribute('aria-label', `Reorder ${column.label}`);
      drag.tabIndex = -1;
      drag.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="5" r="1"/><circle cx="13" cy="5" r="1"/><circle cx="7" cy="10" r="1"/><circle cx="13" cy="10" r="1"/><circle cx="7" cy="15" r="1"/><circle cx="13" cy="15" r="1"/></svg>';
      drag.addEventListener('dragstart', (event) => {
        draggingColumnId = column.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', column.id);
        row.dataset.dragging = 'true';
      });
      drag.addEventListener('dragend', () => {
        draggingColumnId = null;
        panel.querySelectorAll('[data-dragging]').forEach((item) => delete item.dataset.dragging);
      });

      const visibility = createCheckbox(`Show ${column.label}`, column.visible, () => {
        column.visible = visibility.checked;
        renderColumnsPanel();
        renderPreview();
      });

      const body = document.createElement('div');
      body.className = 'tablesnap-editor-column-body';
      if (editingColumnId === column.id) {
        row.dataset.editing = 'true';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tablesnap-editor-column-input';
        input.value = column.label;
        input.setAttribute('aria-label', `Rename ${column.label}`);
        const save = iconButton('Save column name', '<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>');
        const cancel = iconButton('Cancel rename', '<svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg>');
        save.classList.add('is-confirm');
        save.addEventListener('click', () => commitColumnRename(column, input));
        cancel.addEventListener('click', () => {
          editingColumnId = null;
          renderColumnsPanel();
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitColumnRename(column, input);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            editingColumnId = null;
            renderColumnsPanel();
          }
        });
        body.append(input, save, cancel);
        requestAnimationFrame(() => {
          input.focus({ preventScroll: true });
          input.select();
        });
      } else {
        const label = document.createElement('span');
        label.className = 'tablesnap-editor-column-label';
        label.textContent = column.label;
        label.title = column.label;
        const edit = iconButton(`Rename ${column.label}`, '<svg viewBox="0 0 20 20"><path d="m4 14-.5 2.5L6 16l8.5-8.5-2-2zM11.5 6.5l2 2"/></svg>');
        edit.addEventListener('click', () => {
          editingColumnId = column.id;
          renderColumnsPanel();
        });
        body.append(label, edit);
      }

      row.addEventListener('dragover', (event) => {
        if (!draggingColumnId || draggingColumnId === column.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain') || draggingColumnId;
        if (!draggedId || draggedId === column.id) return;
        const fromIndex = columns.findIndex((item) => item.id === draggedId);
        const toIndex = columns.findIndex((item) => item.id === column.id);
        if (fromIndex < 0 || toIndex < 0) return;
        const [moved] = columns.splice(fromIndex, 1);
        columns.splice(toIndex, 0, moved);
        draggingColumnId = null;
        renderColumnsPanel();
        renderPreview();
      });

      row.append(drag, visibility, body);
      panel.append(row);
    });
  }

  function createCleanupOption(key, title, description) {
    const label = document.createElement('label');
    label.className = 'tablesnap-editor-cleanup-option';
    label.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;cursor:pointer';
    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-cleanup-copy';
    copy.style.cssText = 'min-width:0;display:block';
    const strong = document.createElement('strong');
    strong.textContent = title;
    strong.style.cssText = 'display:block;font-size:10.5px;font-weight:600;color:#404040';
    const small = document.createElement('span');
    small.textContent = description;
    small.style.cssText = 'display:block;margin-top:2px;font-size:8.5px;line-height:1.25;color:#90959b';
    copy.append(strong, small);

    const input = createCheckbox(title, Boolean(cleanup[key]), () => {
      cleanup[key] = input.checked;
      renderCleanupPanel();
      renderColumnsPanel();
      renderPreview();
    });
    label.append(copy, input);
    return label;
  }

  function renderCleanupPanel() {
    if (!editor) return;
    const panel = editor.querySelector('[data-cleanup-panel]');
    const reset = editor.querySelector('[data-cleanup-reset]');
    if (!panel) return;
    panel.style.cssText = 'display:grid;margin-top:8px';
    panel.replaceChildren(
      createCleanupOption('trimWhitespace', 'Trim whitespace', 'Remove spaces at the start and end'),
      createCleanupOption('collapseSpaces', 'Collapse extra spaces', 'Turn repeated spaces into one'),
      createCleanupOption('normalizeLineBreaks', 'Normalize line breaks', 'Use consistent line breaks in cells'),
      createCleanupOption('removeEmptyRows', 'Remove empty rows', 'Drop rows with no values'),
      createCleanupOption('removeEmptyColumns', 'Remove empty columns', 'Drop columns with no row values'),
      createCleanupOption('removeDuplicateRows', 'Remove duplicate rows', 'Keep the first identical row')
    );
    if (reset) {
      reset.disabled = !Object.values(cleanup).some(Boolean);
      reset.style.cssText = 'margin:0;padding:3px 6px;border:0;background:transparent;font-size:9px;font-weight:600;color:var(--ts-accent,#2563eb);cursor:pointer';
      if (reset.disabled) reset.style.opacity = '.35';
    }
    const head = editor.querySelector('.tablesnap-editor-cleanup-head');
    if (head) head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:10px';
  }

  function prepareSourceCardHost(card) {
    card.replaceChildren();
    card.classList.add('tablesnap-editor-source-host');
    card.style.setProperty('display', 'block', 'important');
    card.style.setProperty('width', '0', 'important');
    card.style.setProperty('height', '0', 'important');
    card.style.setProperty('min-width', '0', 'important');
    card.style.setProperty('min-height', '0', 'important');
    card.style.setProperty('max-height', 'none', 'important');
    card.style.setProperty('padding', '0', 'important');
    card.style.setProperty('border', '0', 'important');
    card.style.setProperty('border-radius', '0', 'important');
    card.style.setProperty('background', 'transparent', 'important');
    card.style.setProperty('box-shadow', 'none', 'important');
    card.style.setProperty('overflow', 'visible', 'important');
  }

  function openEditor(card) {
    sourceCard = card;
    sourceIcon = document.querySelector('.tablesnap-export-icon[data-card-open="true"]') || sourceIcon;
    if (!sourceTarget && sourceIcon) {
      const resolved = resolveTargetFromIcon(sourceIcon);
      sourceTarget = resolved.target;
      sourceType = resolved.type;
    }
    if (editor?.isConnected) return;

    capturedSnapshot = normalizedSnapshot(parseSourceTarget());
    selectedRows = new Set(capturedSnapshot.rows.map((_, index) => index));
    searchQuery = '';
    cleanup = { ...DEFAULT_CLEANUP };
    initializeColumns();

    prepareSourceCardHost(sourceCard);
    editor = createEditor();
    sourceCard.append(editor);
    document.documentElement.classList.add('tablesnap-editor-open');
    renderColumnsPanel();
    renderCleanupPanel();
    renderPreview();
    requestAnimationFrame(() => editor?.classList.add('is-open'));
    editor.querySelector('[data-table-search]')?.focus({ preventScroll: true });
  }

  function findSourceCard() {
    return [...document.querySelectorAll(SOURCE_CARD_SELECTOR)].find((card) => !card.closest(EDITOR_SELECTOR));
  }

  document.addEventListener('pointerdown', (event) => {
    const icon = event.target.closest?.('.tablesnap-export-icon');
    if (!icon) return;
    sourceIcon = icon;
    const resolved = resolveTargetFromIcon(icon);
    sourceTarget = resolved.target;
    sourceType = resolved.type;
  }, true);

  document.addEventListener('click', (event) => {
    if (suppressIconHandling || !editor) return;
    const icon = event.target.closest?.('.tablesnap-export-icon');
    if (!icon || icon !== sourceIcon) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeThroughSourceIcon();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && editor && editingColumnId === null) {
      event.preventDefault();
      closeThroughSourceIcon();
    }
  });

  const tableEditorObserver = new MutationObserver(() => {
    const card = findSourceCard();
    if (card) {
      if (card !== sourceCard) openEditor(card);
      return;
    }
    if (editor && sourceCard && !sourceCard.isConnected) closeEditorOnly();
  });

  tableEditorObserver.observe(document.documentElement, { childList: true, subtree: true });
})();