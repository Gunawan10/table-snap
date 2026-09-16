(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SOURCE_CARD_SELECTOR = '.tablesnap-export-card, .tablesnap-modern-export-card';

  let editor = null;
  let sourceCard = null;
  let sourceIcon = null;
  let sourceTarget = null;
  let sourceType = null;
  let suppressIconHandling = false;
  let snapshot = { headers: [], rows: [] };
  let selectedRows = new Set();
  let searchQuery = '';

  function closeEditorOnly() {
    editor?.remove();
    editor = null;
    sourceCard = null;
    sourceIcon = null;
    sourceTarget = null;
    sourceType = null;
    snapshot = { headers: [], rows: [] };
    selectedRows = new Set();
    searchQuery = '';
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

  function createSection(title, description) {
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
                <span data-selection-count></span>
              </div>
              <label class="tablesnap-editor-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
                <input type="search" data-table-search placeholder="Search table..." autocomplete="off" spellcheck="false">
              </label>
            </div>
            <div class="tablesnap-editor-preview" data-table-preview></div>
          </main>

          <aside class="tablesnap-editor-sidebar">
            ${createSection('Columns', 'Show, rename, and reorder')}
            ${createSection('Data Cleanup', 'Clean captured values')}
            ${createSection('Content', 'Links and formatting')}
            ${createSection('File Settings', 'Filename and headers')}
            ${createSection('Format Settings', 'Options for the selected format')}
          </aside>
        </div>

        <footer class="tablesnap-editor-footer">
          <label class="tablesnap-editor-format">
            <span>Format</span>
            <select disabled aria-label="Export format">
              <option>CSV</option>
            </select>
          </label>
          <div class="tablesnap-editor-footer-actions">
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
      const candidates = [
        ...document.querySelectorAll('[role="table"], [role="grid"], [role="treegrid"], div, section')
      ].filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        if (Math.abs(rect.top - iconRect.top) > 64) return false;
        return Boolean(window.__TableSnapModern.getModernType(candidate));
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

  function visibleRowIndexes() {
    if (!searchQuery) return snapshot.rows.map((_, index) => index);

    return snapshot.rows.reduce((matches, row, index) => {
      const haystack = row.join('\n').toLocaleLowerCase();
      if (haystack.includes(searchQuery)) matches.push(index);
      return matches;
    }, []);
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
    empty.innerHTML = `
      <div class="tablesnap-editor-preview-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg>
      </div>`;
    const strong = document.createElement('strong');
    strong.textContent = title;
    const span = document.createElement('span');
    span.textContent = description;
    empty.append(strong, span);
    preview.append(empty);
  }

  function updateCounters(visibleIndexes) {
    if (!editor) return;
    const count = editor.querySelector('[data-table-count]');
    const selection = editor.querySelector('[data-selection-count]');
    const totalRows = snapshot.rows.length;
    const columns = snapshot.headers.length;

    if (count) {
      count.textContent = searchQuery && visibleIndexes.length !== totalRows
        ? `${visibleIndexes.length} of ${totalRows} rows × ${columns} columns`
        : `${totalRows} rows × ${columns} columns`;
    }
    if (selection) {
      selection.textContent = `${selectedRows.size} row${selectedRows.size === 1 ? '' : 's'} selected`;
    }
  }

  function renderPreview() {
    if (!editor) return;
    const preview = editor.querySelector('[data-table-preview]');
    if (!preview) return;
    preview.replaceChildren();

    const visibleIndexes = visibleRowIndexes();
    updateCounters(visibleIndexes);

    if (!snapshot.headers.length) {
      renderEmpty(preview, 'No table data found', 'TableSnap could not create a structured preview for this table.');
      return;
    }

    if (!visibleIndexes.length) {
      renderEmpty(preview, 'No matching rows', 'Try a different search term.');
      return;
    }

    const scroller = document.createElement('div');
    scroller.className = 'tablesnap-editor-table-scroll';
    const table = document.createElement('table');
    table.className = 'tablesnap-editor-data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const selectHead = document.createElement('th');
    selectHead.className = 'tablesnap-editor-select-cell';
    const selectAll = createCheckbox('Select all rows', false, () => {
      if (selectAll.checked) {
        snapshot.rows.forEach((_, index) => selectedRows.add(index));
      } else {
        selectedRows.clear();
      }
      renderPreview();
    });
    setCheckboxState(
      selectAll,
      selectedRows.size === snapshot.rows.length && snapshot.rows.length > 0,
      selectedRows.size > 0 && selectedRows.size < snapshot.rows.length
    );
    selectHead.append(selectAll);
    headerRow.append(selectHead);

    snapshot.headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.append(th);
    });
    thead.append(headerRow);

    const tbody = document.createElement('tbody');
    visibleIndexes.forEach((rowIndex) => {
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

      snapshot.rows[rowIndex].forEach((value) => {
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

    snapshot = normalizedSnapshot(parseSourceTarget());
    selectedRows = new Set(snapshot.rows.map((_, index) => index));
    searchQuery = '';

    prepareSourceCardHost(sourceCard);
    editor = createEditor();
    sourceCard.append(editor);
    document.documentElement.classList.add('tablesnap-editor-open');
    renderPreview();
    requestAnimationFrame(() => editor?.classList.add('is-open'));
    editor.querySelector('[data-table-search]')?.focus({ preventScroll: true });
  }

  function findSourceCard() {
    return [...document.querySelectorAll(SOURCE_CARD_SELECTOR)]
      .find((card) => !card.closest(EDITOR_SELECTOR));
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
    if (event.key === 'Escape' && editor) {
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
