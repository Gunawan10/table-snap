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

function extractCellText(cell) {
  const clone = cell.cloneNode(true);

  clone.querySelectorAll([
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[aria-hidden="true"]',
    '[hidden]',
    '.tablesnap-export-icon',
    '.tablesnap-export-card'
  ].join(',')).forEach((node) => node.remove());

  clone.querySelectorAll('img[alt]').forEach((image) => {
    const alt = cleanText(image.getAttribute('alt'));
    if (alt) image.replaceWith(document.createTextNode(alt));
    else image.remove();
  });

  return cleanText(clone.textContent || '');
}

function getVisibleRows(table) {
  return [...table.rows].filter((row) => {
    if (isHiddenElement(row)) return false;
    return [...row.cells].some(isVisibleCell);
  });
}

function rowSignature(row) {
  return [...row.cells]
    .filter(isVisibleCell)
    .map((cell) => extractCellText(cell).toLowerCase())
    .join('|');
}

function removeDuplicateStickyHeaders(table, rows) {
  const headerRows = table.tHead
    ? [...table.tHead.rows].filter((row) => rows.includes(row))
    : rows.filter((row) => [...row.cells].some((cell) => cell.tagName === 'TH'));

  if (!headerRows.length) return rows;

  const headerSignatures = new Set(headerRows.map(rowSignature).filter(Boolean));

  return rows.filter((row) => {
    if (headerRows.includes(row)) return true;

    const cells = [...row.cells].filter(isVisibleCell);
    if (!cells.length) return false;

    const signature = rowSignature(row);
    if (!signature || !headerSignatures.has(signature)) return true;

    const marker = `${row.id} ${row.className}`.toLowerCase();
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
    [...row.cells].filter(isVisibleCell).forEach((cell) => {
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
        for (let c = columnIndex; c < columnIndex + colspan; c += 1) grid[r][c] = entry;
      }
      columnIndex += colspan;
    });
  });
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null));
}

function detectHeaderRowCount(table, rows) {
  if (table.tHead?.rows.length) {
    return [...table.tHead.rows].filter((row) => rows.includes(row)).length;
  }
  let count = 0;
  for (const row of rows) {
    const cells = [...row.cells].filter(isVisibleCell);
    if (!cells.length || !cells.some((cell) => cell.tagName === 'TH')) break;
    count += 1;
  }
  return count;
}

function normalizeHeaders(grid, headerRowCount) {
  if (!grid.length) return [];
  return Array.from({ length: grid[0].length }, (_, column) => {
    const parts = [];
    let lastEntry = null;
    for (let row = 0; row < headerRowCount; row += 1) {
      const entry = grid[row]?.[column];
      if (!entry || entry === lastEntry || !entry.text) continue;
      if (parts[parts.length - 1] !== entry.text) parts.push(entry.text);
      lastEntry = entry;
    }
    return parts.join(' / ') || `Column ${column + 1}`;
  });
}

function parseTable(table) {
  const visibleRows = getVisibleRows(table);
  const rows = removeDuplicateStickyHeaders(table, visibleRows);
  const grid = buildLogicalGrid(rows);
  const headerRowCount = detectHeaderRowCount(table, rows);
  const headers = normalizeHeaders(grid, headerRowCount);
  if (!headers.length && grid.length) {
    return {
      headers: Array.from({ length: grid[0].length }, (_, index) => `Column ${index + 1}`),
      rows: grid.map((row) => row.map((entry) => entry?.text ?? ''))
    };
  }
  return {
    headers,
    rows: grid.slice(headerRowCount).map((row) => row.map((entry) => entry?.text ?? ''))
  };
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

async function exportImage(table) {
  const canvas = await html2canvas(table, {
    backgroundColor: null,
    scale: settings.imageScale,
    useCORS: true,
    logging: false,
    windowWidth: Math.max(document.documentElement.scrollWidth, table.scrollWidth),
    onclone: (doc) => {
      doc.querySelectorAll('.tablesnap-export-icon, .tablesnap-export-card').forEach((node) => node.remove());
    }
  });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Failed to create PNG')), 'image/png');
  });
  downloadBlob(blob, createFilename(table, 'png'));
}

async function exportTable(table, format) {
  if (format === 'image') return exportImage(table);
  const parsed = parseTable(table);
  if (format === 'markdown') {
    return downloadBlob(new Blob([toMarkdown(parsed)], { type: 'text/markdown;charset=utf-8' }), createFilename(table, 'md'));
  }
  const csv = `\uFEFF${toCsv(parsed, settings.csvDelimiter)}`;
  return downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), createFilename(table, 'csv'));
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

function isVisibleTable(table) {
  if (!(table instanceof HTMLTableElement) || table.rows.length === 0) return false;
  const style = getComputedStyle(table);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = table.getBoundingClientRect();
  return rect.width > 24 && rect.height > 24;
}

function observeTables(onTable) {
  const seen = new WeakSet();
  const scan = (root = document) => {
    const tables = root instanceof HTMLTableElement ? [root] : [...(root.querySelectorAll?.('table') || [])];
    tables.forEach((table) => {
      if (!seen.has(table) && isVisibleTable(table)) {
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

function attachTable(table) {
  controls.set(table, createExportIcon(table));
}

function applySettings(next) {
  settings = next;
  closeCard();
  for (const [table, control] of [...controls.entries()]) {
    control.destroy();
    controls.delete(table);
    if (table.isConnected) controls.set(table, createExportIcon(table));
  }
}

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
    if (activeCard && !activeCard.contains(event.target) && !event.target.closest('.tablesnap-export-icon')) closeCard();
  }, true);
})();
