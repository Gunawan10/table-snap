import { getExporter, serializeExport } from './exporters/index.js';

const FORMATS = ['csv', 'xlsx', 'json', 'markdown', 'png', 'pdf', 'tsv', 'html', 'sql', 'ndjson'];
const LEGACY_SAVE_FORMATS = new Set(['csv', 'markdown', 'png']);
const NON_COPYABLE_FORMATS = new Set(['xlsx', 'pdf', 'png']);

const FORMAT_META = {
  csv: { label: 'CSV', tone: 'green' },
  xlsx: { label: 'XLSX', tone: 'excel' },
  json: { label: 'JSON', tone: 'purple' },
  markdown: { label: 'Markdown', tone: 'slate' },
  png: { label: 'PNG', tone: 'orange' },
  pdf: { label: 'PDF', tone: 'red' },
  tsv: { label: 'TSV', tone: 'violet' },
  html: { label: 'HTML', tone: 'orange' },
  sql: { label: 'SQL', tone: 'blue' },
  ndjson: { label: 'NDJSON', tone: 'teal' }
};

let activeSource = null;
let csvDelimiter = ',';

function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
}

function getNativeSourceForIcon(icon) {
  const rect = icon.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const candidates = [...document.querySelectorAll('table')].filter((table) => {
    const tableRect = table.getBoundingClientRect();
    return x >= tableRect.left - 20 && x <= tableRect.right + 20 && y >= tableRect.top - 20 && y <= tableRect.bottom + 20;
  });
  if (!candidates.length) return null;
  const presentation = candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0];
  return window.__TableSnapCore?.resolveDataTable?.(presentation) || presentation;
}

function getModernSourceForIcon(icon) {
  const modern = window.__TableSnapModern;
  if (!modern?.getModernType) return null;
  const rect = icon.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const candidates = [...document.querySelectorAll('[role="table"], [role="grid"], [role="treegrid"], div, section')]
    .filter((element) => {
      if (!modern.getModernType(element)) return false;
      const targetRect = element.getBoundingClientRect();
      return x >= targetRect.left - 20 && x <= targetRect.right + 20 && y >= targetRect.top - 20 && y <= targetRect.bottom + 20;
    });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0];
}

function parseActiveSource() {
  if (!activeSource) return null;
  if (activeSource.type === 'modern') {
    return window.__TableSnapModern?.parseModernTable?.(activeSource.element) || null;
  }
  return window.__TableSnapCore?.parseTable?.(activeSource.element) || null;
}

function sourceLabel() {
  const element = activeSource?.element;
  if (!element) return 'table';
  const aria = cleanText(element.getAttribute?.('aria-label') || '');
  if (aria) return aria;
  const caption = cleanText(element.caption?.textContent || '');
  if (caption) return caption;
  return cleanText(document.title || '') || 'table';
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'table';
}

function createFilename(extension) {
  return `table-${slugify(sourceLabel())}-${new Date().toISOString().slice(0, 10)}.${extension}`;
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

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.documentElement.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function exporterOptions() {
  return { tableName: 'table_data' };
}

function normalizedFormat(format) {
  return format === 'image' ? 'png' : format;
}

function legacyFormat(format) {
  return format === 'png' ? 'image' : format;
}

function getLegacySaveButton(card, format) {
  const value = legacyFormat(format);
  if (card.classList.contains('tablesnap-modern-export-card')) {
    return card.querySelector(`[data-modern-format="${value}"]`);
  }
  return card.querySelector(`[data-format="${value}"]`);
}

async function handleExpandedExport(button, format) {
  const parsed = parseActiveSource();
  const exporter = getExporter(format);
  if (!parsed?.headers?.length || !exporter) throw new Error('No table data detected');

  button.disabled = true;
  try {
    const blob = typeof exporter.createBlob === 'function'
      ? await exporter.createBlob(parsed, exporterOptions())
      : new Blob([serializeExport(format, parsed, exporterOptions())], { type: exporter.mimeType });
    downloadBlob(blob, createFilename(exporter.extension));
    showActionState(button, 'Saved');
  } finally {
    setTimeout(() => { if (button.isConnected) button.disabled = false; }, 700);
  }
}

async function copyFormat(button, format) {
  const parsed = parseActiveSource();
  if (!parsed?.headers?.length) throw new Error('No table data detected');

  let output;
  if (format === 'csv') {
    output = window.__TableSnapCore?.toCsv?.(parsed, csvDelimiter);
  } else if (format === 'markdown') {
    output = window.__TableSnapCore?.toMarkdown?.(parsed);
  } else {
    const exporter = getExporter(format);
    if (!exporter || exporter.copyable === false || typeof exporter.serialize !== 'function') {
      throw new Error('Format is not copyable');
    }
    output = serializeExport(format, parsed, exporterOptions());
  }

  if (typeof output !== 'string') throw new Error('Unable to serialize table');
  await copyText(output);
  showActionState(button, 'Copied');
}

function showActionState(button, text) {
  const label = button.querySelector('.tablesnap-tile-action-label');
  if (!label) return;
  const original = label.textContent;
  label.textContent = text;
  setTimeout(() => {
    if (button.isConnected) label.textContent = original;
  }, 900);
}

function actionIcon(type) {
  if (type === 'save') {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m0 0 3-3m-3 3L7 9M4 14v2h12v-2"/></svg>';
  }
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="9" height="10" rx="1.5"/><path d="M13 6V4H4v9h3"/></svg>';
}

function formatIcon(format) {
  const icons = {
    csv: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><rect x="11.5" y="14" width="11" height="8" rx="1.5"/><path d="M15.2 14v8M18.8 14v8M11.5 18h11"/></svg>',
    xlsx: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="sheet" d="M12 4h13a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H12z"/><rect class="front" x="5" y="8" width="14" height="18" rx="2"/><path d="m9 13 6 8M15 13l-6 8"/></svg>',
    json: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><path d="M15 13c-2 0-2 2-2 3s-1 1.5-2 1.5c1 0 2 .5 2 1.5s0 3 2 3M19 13c2 0 2 2 2 3s1 1.5 2 1.5c-1 0-2 .5-2 1.5s0 3-2 3"/></svg>',
    markdown: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><path d="M11 15v7m0-7 3 4 3-4v7M20 15v7m0 0-2-2m2 2 2-2"/></svg>',
    png: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><circle cx="14" cy="15" r="2"/><path d="m11 24 5-5 3 3 2-2 3 4z"/></svg>',
    pdf: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><text x="17" y="22" text-anchor="middle">PDF</text></svg>',
    tsv: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><text x="17" y="22" text-anchor="middle">TSV</text></svg>',
    html: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><path d="m15 14-4 4 4 4M19 14l4 4-4 4"/></svg>',
    sql: '<svg viewBox="0 0 34 34" aria-hidden="true"><ellipse cx="17" cy="9" rx="9" ry="4"/><path d="M8 9v7c0 2.2 4 4 9 4s9-1.8 9-4V9M8 16v7c0 2.2 4 4 9 4s9-1.8 9-4v-7"/></svg>',
    ndjson: '<svg viewBox="0 0 34 34" aria-hidden="true"><path class="doc" d="M8 3h12l6 6v22H8z"/><path class="fold" d="M20 3v7h6"/><text x="17" y="21" text-anchor="middle">ND</text></svg>'
  };
  return icons[format] || '';
}

function tileMarkup(format) {
  const meta = FORMAT_META[format];
  const copyable = !NON_COPYABLE_FORMATS.has(format);
  return `
    <div class="tablesnap-format-tile" data-tile-format="${format}">
      <div class="tablesnap-format-visual">
        <span class="tablesnap-format-icon tone-${meta.tone}">${formatIcon(format)}</span>
        <span class="tablesnap-format-label">${meta.label}</span>
      </div>
      <div class="tablesnap-tile-overlay" aria-hidden="true"></div>
      <div class="tablesnap-tile-actions">
        <button type="button" class="tablesnap-tile-action is-save" data-tile-save="${format}">
          ${actionIcon('save')}<span class="tablesnap-tile-action-label">Save</span>
        </button>
        ${copyable ? `<button type="button" class="tablesnap-tile-action is-copy" data-tile-copy="${format}">
          ${actionIcon('copy')}<span class="tablesnap-tile-action-label">Copy</span>
        </button>` : ''}
      </div>
    </div>`;
}

function modernizeCard(card) {
  if (card.dataset.tablesnapModernized === 'true') return;

  const legacyButtons = new Map();
  LEGACY_SAVE_FORMATS.forEach((format) => {
    const button = getLegacySaveButton(card, format);
    if (button) legacyButtons.set(format, button);
  });

  const header = card.querySelector('.tablesnap-card-header, .tablesnap-modern-head');
  if (header) {
    const strong = header.querySelector('strong');
    const subtitle = header.querySelector('span:last-child');
    if (strong) strong.textContent = 'Export Table';
    if (subtitle && !subtitle.querySelector('svg')) subtitle.textContent = 'Choose a format to export';
  }

  const oldActions = card.querySelector('.tablesnap-card-actions, .tablesnap-modern-actions');
  const oldCopy = card.querySelector('.tablesnap-copy-actions, .tablesnap-modern-copy');
  if (!oldActions) return;

  oldActions.classList.add('tablesnap-legacy-actions-hidden');
  oldCopy?.classList.add('tablesnap-legacy-actions-hidden');

  const ui = document.createElement('div');
  ui.className = 'tablesnap-compact-export-ui';
  ui.innerHTML = `<div class="tablesnap-format-grid">${FORMATS.map(tileMarkup).join('')}</div>`;
  oldActions.after(ui);

  ui.addEventListener('click', (event) => {
    const saveButton = event.target.closest('[data-tile-save]');
    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      const format = normalizedFormat(saveButton.dataset.tileSave);
      if (LEGACY_SAVE_FORMATS.has(format)) {
        const original = legacyButtons.get(format);
        if (original) original.click();
      } else {
        handleExpandedExport(saveButton, format)
          .catch((error) => console.error('[TableSnap] Export failed:', error));
      }
      return;
    }

    const copyButton = event.target.closest('[data-tile-copy]');
    if (!copyButton) return;
    event.preventDefault();
    event.stopPropagation();
    copyFormat(copyButton, normalizedFormat(copyButton.dataset.tileCopy))
      .catch((error) => console.error('[TableSnap] Copy failed:', error));
  }, true);

  card.dataset.tablesnapModernized = 'true';
}

document.addEventListener('click', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (!icon) return;

  if (icon.dataset.tablesnapModern === 'true') {
    const element = getModernSourceForIcon(icon);
    if (element) activeSource = { type: 'modern', element };
  } else {
    const element = getNativeSourceForIcon(icon);
    if (element) activeSource = { type: 'native', element };
  }
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('.tablesnap-export-card, .tablesnap-modern-export-card').forEach(modernizeCard);
});

observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.storage.local.get({ csvDelimiter: ',' }).then((stored) => {
  csvDelimiter = stored.csvDelimiter || ',';
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.csvDelimiter) csvDelimiter = changes.csvDelimiter.newValue || ',';
});
