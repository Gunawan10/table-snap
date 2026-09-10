import { getExporter, serializeExport } from './exporters/index.js';

const COMMON_FORMATS = ['csv', 'xlsx', 'json', 'markdown', 'pdf', 'png'];
const MORE_FORMATS = ['tsv', 'html', 'sql', 'ndjson'];
const LEGACY_SAVE_FORMATS = new Set(['csv', 'markdown', 'png']);
const NON_COPYABLE_FORMATS = new Set(['xlsx', 'pdf', 'png']);

const FORMAT_META = {
  csv: { label: 'CSV', badge: 'CSV', tone: 'green' },
  xlsx: { label: 'XLSX', badge: 'X', tone: 'green' },
  json: { label: 'JSON', badge: '{}', tone: 'purple' },
  markdown: { label: 'Markdown', badge: 'MD', tone: 'slate' },
  pdf: { label: 'PDF', badge: 'PDF', tone: 'red' },
  png: { label: 'PNG', badge: 'PNG', tone: 'orange' },
  tsv: { label: 'TSV', badge: 'TSV', tone: 'violet' },
  html: { label: 'HTML', badge: '</>', tone: 'orange' },
  sql: { label: 'SQL', badge: 'DB', tone: 'blue' },
  ndjson: { label: 'NDJSON', badge: 'ND', tone: 'teal' }
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

function tileMarkup(format) {
  const meta = FORMAT_META[format];
  const copyable = !NON_COPYABLE_FORMATS.has(format);
  return `
    <div class="tablesnap-format-tile" data-tile-format="${format}">
      <div class="tablesnap-format-visual">
        <span class="tablesnap-format-badge tone-${meta.tone}">${meta.badge}</span>
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

function sectionMarkup(title, formats) {
  return `
    <section class="tablesnap-format-section">
      <div class="tablesnap-format-section-title">${title}</div>
      <div class="tablesnap-format-grid">${formats.map(tileMarkup).join('')}</div>
    </section>`;
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
    if (subtitle && !subtitle.querySelector('svg')) subtitle.textContent = 'Choose a format';
  }

  const oldActions = card.querySelector('.tablesnap-card-actions, .tablesnap-modern-actions');
  const oldCopy = card.querySelector('.tablesnap-copy-actions, .tablesnap-modern-copy');
  if (!oldActions) return;

  oldActions.classList.add('tablesnap-legacy-actions-hidden');
  oldCopy?.classList.add('tablesnap-legacy-actions-hidden');

  const ui = document.createElement('div');
  ui.className = 'tablesnap-compact-export-ui';
  ui.innerHTML = `${sectionMarkup('Common', COMMON_FORMATS)}${sectionMarkup('More', MORE_FORMATS)}`;
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
