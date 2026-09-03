import html2canvas from 'html2canvas';

const DEFAULT_SETTINGS = Object.freeze({
  iconVisibility: 'hover',
  iconPosition: 'top-right',
  iconSize: 'small',
  defaultFormat: 'csv',
  csvDelimiter: ',',
  imageScale: 2,
  theme: 'system'
});

const MIN_SAVE_STATE_MS = 450;
const SAVED_STATE_MS = 650;

let settings;
let activeCard = null;
let activeTable = null;
const controls = new Map();
const attachedPresentationTables = new WeakSet();

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function isHiddenElement(element) {
  if (!(element instanceof Element)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  const style = getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
}

function isVisibleCell(cell) {
  if (isHiddenElement(cell)) return false;
  const rect = cell.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isBasicVisibleTable(table) {
  if (!(table instanceof HTMLTableElement) || table.rows.length === 0) return false;
  if (isHiddenElement(table)) return false;
  const rect = table.getBoundingClientRect();
  return rect.width > 24 && rect.height > 24;
}

function extractCellText(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll([
    'script', 'style', 'noscript', 'svg', 'canvas', 'button', 'input', 'select', 'textarea', 'img',
    '[role="button"]', '[aria-hidden="true"]', '[hidden]', '.tablesnap-export-icon', '.tablesnap-export-card'
  ].join(',')).forEach((node) => node.remove());
  return cleanText(clone.textContent || '');
}

function visibleCells(row) {
  return [...row.cells].filter(isVisibleCell);
}

function countColumnsInRow(row) {
  return visibleCells(row).reduce((total, cell) => {
    return total + Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10));
  }, 0);
}

function getHeaderRows(table) {
  if (table.tHead) {
    const rows = [...table.tHead.rows].filter((row) => !isHiddenElement(row) && visibleCells(row).length);
    if (rows.length) return rows;
  }

  const rows = [];
  for (const row of [...table.rows]) {
    if (isHiddenElement(row)) continue;
    const cells = visibleCells(row);
    if (!cells.length || !cells.some((cell) => cell.tagName === 'TH')) break;
    rows.push(row);
  }
  return rows;
}

function getDataRows(table) {
  const rows = [];
  [...table.tBodies].forEach((tbody) => {
    [...tbody.rows].forEach((row) => {
      if (isHiddenElement(row)) return;
      const cells = visibleCells(row);
      if (!cells.length) return;
      if (cells.some((cell) => extractCellText(cell) !== '')) rows.push(row);
    });
  });
  return rows;
}

function hasVisibleDataRows(table) {
  return getDataRows(table).length > 0;
}

function getExpectedColumnCount(table) {
  const dataRow = getDataRows(table)[0];
  if (dataRow) return countColumnsInRow(dataRow);

  const headerRows = getHeaderRows(table);
  if (headerRows.length) {
    return Math.max(...headerRows.map(countColumnsInRow));
  }
  return 0;
}

function widthsRoughlyMatch(a, b) {
  const ar = a.getBoundingClientRect();
  const br = b.getBoundingClientRect();
  const max = Math.max(ar.width, br.width, 1);
  return Math.abs(ar.width - br.width) / max < 0.2;
}

function findTableGroup(table) {
  const expected = getExpectedColumnCount(table);
  let ancestor = table.parentElement;

  for (let depth = 0; ancestor && depth < 6; depth += 1, ancestor = ancestor.parentElement) {
    const all = [...ancestor.querySelectorAll('table')].filter(isBasicVisibleTable);
    if (all.length < 2 || all.length > 12) continue;

    const compatible = all.filter((candidate) => {
      const columns = getExpectedColumnCount(candidate);
      return (!expected || !columns || columns === expected) && widthsRoughlyMatch(table, candidate);
    });

    const hasHeader = compatible.some((candidate) => getHeaderRows(candidate).length > 0);
    const hasBody = compatible.some(hasVisibleDataRows);

    if (compatible.length > 1 && hasHeader && hasBody) {
      return { root: ancestor, tables: compatible };
    }
  }

  return { root: table, tables: [table] };
}

function resolveDataTable(table) {
  const { tables } = findTableGroup(table);
  const candidates = tables.filter(hasVisibleDataRows);
  if (!candidates.length) return table;

  return candidates.sort((a, b) => getDataRows(b).length - getDataRows(a).length)[0];
}

function resolveHeaderTable(triggerTable, dataTable) {
  const dataColumns = getExpectedColumnCount(dataTable);
  const { tables } = findTableGroup(triggerTable);

  const triggerHeaders = getHeaderRows(triggerTable);
  if (triggerHeaders.length && (!dataColumns || getExpectedColumnCount(triggerTable) === dataColumns)) {
    return triggerTable;
  }

  return tables.find((candidate) => {
    return getHeaderRows(candidate).length > 0
      && (!dataColumns || getExpectedColumnCount(candidate) === dataColumns);
  }) || dataTable;
}

function resolvePresentationTable(table) {
  const { tables } = findTableGroup(table);

  const headerOnly = tables.find((candidate) => getHeaderRows(candidate).length > 0 && !hasVisibleDataRows(candidate));
  if (headerOnly) return headerOnly;

  return tables.find((candidate) => getHeaderRows(candidate).length > 0) || table;
}

function rowSignature(row) {
  return visibleCells(row).map((cell) => extractCellText(cell).toLowerCase()).join('|');
}

function removeDuplicateStickyRows(rows, headerRows) {
  if (!headerRows.length) return rows;
  const signatures = new Set(headerRows.map(rowSignature).filter(Boolean));

  return rows.filter((row) => {
    const signature = rowSignature(row);
    if (!signature || !signatures.has(signature)) return true;

    const cells = visibleCells(row);
    const marker = `${row.id} ${row.className} ${row.parentElement?.id || ''} ${row.parentElement?.className || ''}`.toLowerCase();
    const headerLike = cells.every((cell) => cell.tagName === 'TH');
    const stickyLike = /sticky|clone|cloned|floating|frozen|fixed|header/.test(marker);
    return !(headerLike || stickyLike);
  });
}

function buildLogicalGrid(rows) {
  const grid = [];

  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let columnIndex = 0;

    visibleCells(row).forEach((cell) => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex += 1;

      const rowspan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') || '1', 10));
      const colspan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10));
      const entry = {
        text: extractCellText(cell),
        originRow: rowIndex,
        originColumn: columnIndex
      };

      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        grid[r] ||= [];
        for (let c = columnIndex; c < columnIndex + colspan; c += 1) {
          grid[r][c] = entry;
        }
      }
      columnIndex += colspan;
    });
  });

  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null));
}

function normalizeHeaders(headerGrid, width) {
  if (!width) return [];

  return Array.from({ length: width }, (_, column) => {
    const parts = [];
    let lastEntry = null;

    for (let row = 0; row < headerGrid.length; row += 1) {
      const entry = headerGrid[row]?.[column];
      if (!entry || entry === lastEntry || !entry.text) continue;
      if (parts[parts.length - 1] !== entry.text) parts.push(entry.text);
      lastEntry = entry;
    }

    return parts.join(' / ') || `Column ${column + 1}`;
  });
}

function isMergedHeaderColumn(headerGrid, column) {
  for (let row = 0; row < headerGrid.length; row += 1) {
    const entry = headerGrid[row]?.[column];
    if (!entry) continue;
    if (headerGrid[row]?.[column - 1] === entry || headerGrid[row]?.[column + 1] === entry) return true;
  }
  return false;
}

function compactDecorativeColumns(headerGrid, headers, rows) {
  if (!headers.length || !rows.length) return { headers, rows };

  const keepColumns = headers.map((header, column) => {
    const hasBodyText = rows.some((row) => cleanText(row[column] || '') !== '');
    if (hasBodyText) return true;
    if (!isMergedHeaderColumn(headerGrid, column)) return true;

    const sameHeaderLeft = column > 0 && headers[column - 1] === header;
    const sameHeaderRight = column < headers.length - 1 && headers[column + 1] === header;
    return !(sameHeaderLeft || sameHeaderRight);
  });

  return {
    headers: headers.filter((_, column) => keepColumns[column]),
    rows: rows.map((row) => row.filter((_, column) => keepColumns[column]))
  };
}

function parseTable(triggerTable) {
  const dataTable = resolveDataTable(triggerTable);
  const headerTable = resolveHeaderTable(triggerTable, dataTable);
  const headerRows = getHeaderRows(headerTable);
  const dataRows = removeDuplicateStickyRows(getDataRows(dataTable), headerRows);

  const headerGrid = buildLogicalGrid(headerRows);
  const dataGrid = buildLogicalGrid(dataRows);

  const width = Math.max(
    headerGrid.reduce((max, row) => Math.max(max, row.length), 0),
    dataGrid.reduce((max, row) => Math.max(max, row.length), 0)
  );

  if (!width) return { headers: [], rows: [] };

  const headers = headerRows.length
    ? normalizeHeaders(headerGrid, width)
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);

  const rows = dataGrid.map((row) => Array.from({ length: width }, (_, index) => row[index]?.text ?? ''));
  return compactDecorativeColumns(headerGrid, headers, rows);
}

function escapeCsv(value, delimiter) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (text.includes('"') || text.includes('\n') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv({ headers, rows }, delimiter) {
  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsv(value, delimiter)).join(delimiter))
    .join('\r\n');
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\r\n?|\n/g, '<br>')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .trim();
}

function markdownRow(values) {
  return `| ${values.map(escapeMarkdown).join(' | ')} |`;
}

function toMarkdown({ headers, rows }) {
  return [markdownRow(headers), markdownRow(headers.map(() => '---')), ...rows.map(markdownRow)].join('\n');
}

function createFilename(table, extension) {
  const source = table.getAttribute('aria-label') || document.title || 'table';
  const title = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'table';
  return `table-${title}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.documentElement.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveImageTarget(table) {
  const group = findTableGroup(table);
  return group.tables.length > 1 ? group.root : table;
}

async function exportImage(table) {
  const target = resolveImageTarget(table);
  const canvas = await html2canvas(target, {
    backgroundColor: null,
    scale: settings.imageScale,
    useCORS: true,
    logging: false,
    windowWidth: Math.max(document.documentElement.scrollWidth, target.scrollWidth),
    onclone: (doc) => {
      doc.querySelectorAll('.tablesnap-export-icon, .tablesnap-export-card').forEach((node) => node.remove());
    }
  });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Failed to create PNG')), 'image/png');
  });

  downloadBlob(blob, createFilename(resolveDataTable(table), 'png'));
}

async function exportTable(table, format) {
  if (format === 'image') return exportImage(table);

  const parsed = parseTable(table);
  const dataTable = resolveDataTable(table);

  if (format === 'markdown') {
    return downloadBlob(
      new Blob([toMarkdown(parsed)], { type: 'text/markdown;charset=utf-8' }),
      createFilename(dataTable, 'md')
    );
  }

  const csv = `\uFEFF${toCsv(parsed, settings.csvDelimiter)}`;
  return downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    createFilename(dataTable, 'csv')
  );
}

function logoSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="11" rx="1"/><path d="M5 11h14M9 7v11M15 7v11M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>`;
}

function spinnerSvg() {
  return '<svg class="tablesnap-spinner" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>';
}

function checkSvg() {
  return '<svg class="tablesnap-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function getStatusIcon(button) {
  let icon = button.querySelector('.tablesnap-download-icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'tablesnap-download-icon';
    button.append(icon);
  }
  return icon;
}

function setSaveState(card, button, state, format) {
  const title = button.querySelector('strong');
  const icon = getStatusIcon(button);
  const allButtons = card.querySelectorAll('button');

  if (!button.dataset.originalTitle && title) button.dataset.originalTitle = title.textContent;
  card.dataset.saving = String(state === 'loading');

  allButtons.forEach((item) => {
    item.disabled = state === 'loading' && item !== button;
  });
  button.disabled = state === 'loading';
  button.dataset.saveState = state;

  if (state === 'loading') {
    if (title) title.textContent = format === 'image' ? 'Rendering image...' : 'Saving...';
    icon.innerHTML = spinnerSvg();
    return;
  }

  if (state === 'saved') {
    if (title) title.textContent = 'Saved';
    icon.innerHTML = checkSvg();
    return;
  }

  if (title) title.textContent = button.dataset.originalTitle || title.textContent;
}

function createExportCard(table) {
  const card = document.createElement('div');
  card.className = 'tablesnap-export-card';
  card.setAttribute('role', 'dialog');
  card.innerHTML = `
    <div class="tablesnap-card-header">
      <div class="tablesnap-logo">${logoSvg()}</div>
      <div><strong>TableSnap</strong><span>Save table in your preferred format</span></div>
    </div>
    <div class="tablesnap-card-actions">
      <button type="button" data-format="csv"><span class="format csv">CSV</span><span><strong>Save as CSV</strong><small>Best for Excel and Google Sheets</small></span></button>
      <button type="button" data-format="markdown"><span class="format markdown">MD</span><span><strong>Save as Markdown</strong><small>Perfect for docs and notes</small></span></button>
      <button type="button" data-format="image"><span class="format image">PNG</span><span><strong>Save as Image</strong><small>Keep the table exactly as shown</small></span></button>
    </div>`;

  card.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-format]');
    if (!button || card.dataset.saving === 'true') return;

    const format = button.dataset.format;
    const startedAt = performance.now();
    setSaveState(card, button, 'loading', format);

    try {
      if (format === 'image') await waitForPaint();
      await exportTable(table, format);

      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_SAVE_STATE_MS) await wait(MIN_SAVE_STATE_MS - elapsed);
      if (!card.isConnected) return;

      setSaveState(card, button, 'saved', format);
      await wait(SAVED_STATE_MS);
      if (card.isConnected) closeCard();
    } catch (error) {
      setSaveState(card, button, 'idle', format);
      card.dataset.saving = 'false';
      card.querySelectorAll('button').forEach((item) => { item.disabled = false; });
      console.error('[TableSnap] Export failed:', error);
    }
  });

  document.documentElement.append(card);
  const defaultButton = card.querySelector(`[data-format="${settings.defaultFormat}"]`);
  if (defaultButton) defaultButton.dataset.default = 'true';
  return card;
}

function closeCard() {
  activeCard?.remove();
  activeCard = null;
  activeTable = null;
}

function positionCard(card, table) {
  const rect = table.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  card.style.width = `${width}px`;
  card.style.left = `${Math.max(window.scrollX + 12, Math.min(window.scrollX + rect.right - width, window.scrollX + window.innerWidth - width - 12))}px`;
  card.style.top = `${window.scrollY + rect.top + 48}px`;
}

function openCard(table) {
  if (activeCard && activeTable === table) return closeCard();

  closeCard();
  activeTable = table;
  activeCard = createExportCard(table);
  positionCard(activeCard, table);
}

function createExportIcon(table) {
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = `tablesnap-export-icon size-${settings.iconSize}`;
  icon.setAttribute('aria-label', 'Export table with TableSnap');
  icon.innerHTML = logoSvg();

  icon.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCard(table);
  });

  document.documentElement.append(icon);

  const updatePosition = () => {
    if (!table.isConnected) return;
    const rect = table.getBoundingClientRect();
    const offset = 8;
    const left = settings.iconPosition === 'top-left'
      ? window.scrollX + rect.left + offset
      : window.scrollX + rect.right - icon.offsetWidth - offset;

    icon.style.top = `${window.scrollY + rect.top + offset}px`;
    icon.style.left = `${left}px`;
  };

  const setVisible = (visible) => icon.classList.toggle('visible', visible);
  if (settings.iconVisibility === 'always') setVisible(true);

  const enter = () => setVisible(true);
  const leave = (event) => {
    if (settings.iconVisibility === 'hover' && !icon.contains(event.relatedTarget)) setVisible(false);
  };
  const iconLeave = (event) => {
    if (settings.iconVisibility === 'hover' && !table.contains(event.relatedTarget)) setVisible(false);
  };

  table.addEventListener('mouseenter', enter);
  table.addEventListener('mouseleave', leave);
  icon.addEventListener('mouseleave', iconLeave);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
  updatePosition();

  return {
    destroy() {
      table.removeEventListener('mouseenter', enter);
      table.removeEventListener('mouseleave', leave);
      icon.removeEventListener('mouseleave', iconLeave);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      icon.remove();
    }
  };
}

function attachTable(table) {
  const presentationTable = resolvePresentationTable(table);
  if (!isBasicVisibleTable(presentationTable) || attachedPresentationTables.has(presentationTable)) return;

  attachedPresentationTables.add(presentationTable);
  controls.set(presentationTable, createExportIcon(presentationTable));
}

function observeTables(onTable) {
  const seen = new WeakSet();

  const scan = (root = document) => {
    const tables = root instanceof HTMLTableElement
      ? [root]
      : [...(root.querySelectorAll?.('table') || [])];

    tables.forEach((table) => {
      if (!seen.has(table) && isBasicVisibleTable(table)) {
        seen.add(table);
        onTable(table);
      }
    });
  };

  scan();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function applySettings(next) {
  settings = next;
  closeCard();

  for (const [table, control] of [...controls.entries()]) {
    control.destroy();
    controls.delete(table);
    if (table.isConnected && isBasicVisibleTable(table)) {
      controls.set(table, createExportIcon(table));
    }
  }
}

window.__TableSnapCore = {
  parseTable,
  resolveDataTable,
  resolveHeaderTable,
  findTableGroup,
  cleanText,
  toCsv,
  toMarkdown
};

(async function init() {
  settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(DEFAULT_SETTINGS)) };
  observeTables(attachTable);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = { ...settings };
    Object.entries(changes).forEach(([key, value]) => { next[key] = value.newValue; });
    applySettings(next);
  });

  document.addEventListener('pointerdown', (event) => {
    if (activeCard && !activeCard.contains(event.target) && !event.target.closest('.tablesnap-export-icon')) {
      closeCard();
    }
  }, true);
})();
