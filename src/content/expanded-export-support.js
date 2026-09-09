import { getExporter, listExporters, serializeExport } from './exporters/index.js';

let activeSource = null;

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

function formatDescription(id) {
  if (id === 'tsv') return 'Tab-separated data for clean copy/paste and imports';
  if (id === 'json') return 'Structured data for apps and APIs';
  if (id === 'html') return 'Portable HTML table markup';
  if (id === 'xlsx') return 'Native spreadsheet workbook';
  if (id === 'sql') return 'SQL INSERT statements';
  if (id === 'ndjson') return 'One JSON object per line';
  return 'Export table';
}

function formatBadge(id) {
  return id.toUpperCase();
}

function markTemporary(button, text) {
  const strong = button.querySelector('strong');
  if (!strong) return;
  const original = strong.textContent;
  strong.textContent = text;
  setTimeout(() => { if (button.isConnected) strong.textContent = original; }, 1000);
}

function addNativeActions(card) {
  if (card.querySelector('[data-tablesnap-expanded="true"]')) return;
  const host = card.querySelector('.tablesnap-card-actions');
  if (!host) return;

  const fragment = document.createDocumentFragment();
  listExporters().forEach((exporter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.expandedFormat = exporter.id;
    button.dataset.tablesnapExpanded = 'true';
    button.innerHTML = `<span class="format ${exporter.id}">${formatBadge(exporter.id)}</span><span><strong>Save as ${exporter.label}</strong><small>${formatDescription(exporter.id)}</small></span>`;
    fragment.append(button);
  });
  host.append(fragment);

  const copyHost = card.querySelector('.tablesnap-copy-actions');
  if (copyHost) addCopyActions(copyHost);
}

function addModernActions(card) {
  if (card.querySelector('[data-tablesnap-expanded="true"]')) return;
  const host = card.querySelector('.tablesnap-modern-actions');
  if (!host) return;

  listExporters().forEach((exporter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.expandedFormat = exporter.id;
    button.dataset.tablesnapExpanded = 'true';
    button.innerHTML = `<b>${formatBadge(exporter.id)}</b><span><strong>Save as ${exporter.label}</strong><small>${formatDescription(exporter.id)}</small></span>`;
    host.append(button);
  });

  const copyHost = card.querySelector('.tablesnap-modern-copy');
  if (copyHost) addCopyActions(copyHost, true);
}

function addCopyActions(host, modern = false) {
  if (host.querySelector('[data-expanded-copy]')) return;
  listExporters()
    .filter((exporter) => exporter.copyable !== false && typeof exporter.serialize === 'function')
    .forEach((exporter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.expandedCopy = exporter.id;
      if (modern) {
        button.textContent = `Copy ${exporter.label}`;
      } else {
        button.innerHTML = `<span class="copy-label"><strong>Copy as ${exporter.label}</strong><small>Copy to clipboard</small></span>`;
      }
      host.append(button);
    });
}

function exporterOptions() {
  return {
    tableName: 'table_data'
  };
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
    markTemporary(button, 'Saved');
  } finally {
    setTimeout(() => { if (button.isConnected) button.disabled = false; }, 700);
  }
}

async function handleExpandedCopy(button, format) {
  const parsed = parseActiveSource();
  const exporter = getExporter(format);
  if (!parsed?.headers?.length || !exporter || exporter.copyable === false || typeof exporter.serialize !== 'function') {
    throw new Error('Format is not copyable');
  }

  await copyText(serializeExport(format, parsed, exporterOptions()));
  if (button.querySelector('strong')) markTemporary(button, 'Copied');
  else {
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1000);
  }
}

document.addEventListener('click', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (icon) {
    if (icon.dataset.tablesnapModern === 'true') {
      const element = getModernSourceForIcon(icon);
      if (element) activeSource = { type: 'modern', element };
    } else {
      const element = getNativeSourceForIcon(icon);
      if (element) activeSource = { type: 'native', element };
    }
    return;
  }

  const exportButton = event.target.closest?.('[data-expanded-format]');
  if (exportButton) {
    event.preventDefault();
    event.stopPropagation();
    handleExpandedExport(exportButton, exportButton.dataset.expandedFormat)
      .catch((error) => console.error('[TableSnap] Expanded export failed:', error));
    return;
  }

  const copyButton = event.target.closest?.('[data-expanded-copy]');
  if (copyButton) {
    event.preventDefault();
    event.stopPropagation();
    handleExpandedCopy(copyButton, copyButton.dataset.expandedCopy)
      .catch((error) => console.error('[TableSnap] Expanded copy failed:', error));
  }
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('.tablesnap-export-card').forEach(addNativeActions);
  document.querySelectorAll('.tablesnap-modern-export-card').forEach(addModernActions);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
