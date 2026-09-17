import html2canvas from 'html2canvas';
import { getExporter, serializeExport } from './exporters/index.js';

const EDITOR_SELECTOR = '.tablesnap-table-editor';
const NON_COPYABLE = new Set(['xlsx', 'png', 'pdf']);
const DEFAULT_EXPORT_OPTIONS = Object.freeze({
  csvDelimiter: ',',
  imageScale: 2,
  pdfOrientation: 'auto',
  pdfPageSize: 'a4',
  xlsxAutoColumnWidth: true,
  xlsxWrapText: true,
  xlsxAutoFilter: true
});
const FORMAT_META = {
  csv: { extension: 'csv', mimeType: 'text/csv;charset=utf-8' },
  xlsx: { extension: 'xlsx' },
  json: { extension: 'json' },
  markdown: { extension: 'md', mimeType: 'text/markdown;charset=utf-8' },
  png: { extension: 'png', mimeType: 'image/png' },
  pdf: { extension: 'pdf' },
  tsv: { extension: 'tsv', mimeType: 'text/tab-separated-values;charset=utf-8' },
  html: { extension: 'html' },
  sql: { extension: 'sql' },
  ndjson: { extension: 'ndjson' }
};

let activeEditor = null;
let editorObserver = null;
let busy = false;
let cachedExportOptions = { ...DEFAULT_EXPORT_OPTIONS };

function currentFormat() {
  return window.__TableSnapEditorFormatSettings?.getFormat?.() || 'csv';
}

function editorSettings() {
  return window.__TableSnapEditorSettings?.getState?.() || {
    preserveLinks: true,
    keepOriginalFormatting: true,
    filename: 'table-export',
    includeHeaders: true
  };
}

function formatOptions(format) {
  return window.__TableSnapEditorFormatSettings?.getOptions?.(format) || {};
}

function searchInput(editor) {
  return editor?.querySelector('[data-table-search]') || null;
}

function dispatchSearch(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function readRenderedTable(editor) {
  const table = editor?.querySelector('.tablesnap-editor-data-table');
  if (!table) return { headers: [], rows: [] };
  const headers = [...table.querySelectorAll('thead th:not(.tablesnap-editor-select-cell)')]
    .map((cell) => cell.textContent || '');
  const rows = [...table.querySelectorAll('tbody tr')]
    .filter((row) => row.dataset.selected === 'true')
    .map((row) => [...row.querySelectorAll('td:not(.tablesnap-editor-select-cell)')]
      .map((cell) => cell.textContent || ''));
  return { headers, rows };
}

function normalizeFormatting(snapshot, settings) {
  if (settings.keepOriginalFormatting !== false) return snapshot;
  return {
    headers: snapshot.headers.map((value) => String(value ?? '').replace(/\s*\n\s*/g, ' ')),
    rows: snapshot.rows.map((row) => row.map((value) => String(value ?? '').replace(/\s*\n\s*/g, ' ')))
  };
}

function captureEditorSnapshot(editor) {
  const input = searchInput(editor);
  const originalQuery = input?.value || '';
  const toggle = editor.querySelector('[data-output-preview-toggle]');
  const wasCode = toggle?.dataset.previewTarget === 'table';

  if (wasCode) toggle.click();
  const tableInput = searchInput(editor);
  if (tableInput?.value) dispatchSearch(tableInput, '');

  const snapshot = normalizeFormatting(readRenderedTable(editor), editorSettings());

  if (wasCode) {
    const backToCode = editor.querySelector('[data-output-preview-toggle]');
    backToCode?.click();
    if (originalQuery) dispatchSearch(searchInput(editor), originalQuery);
  } else if (originalQuery) {
    dispatchSearch(searchInput(editor), originalQuery);
  }

  return snapshot;
}

function escapeDelimited(value, delimiter) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (text.includes('"') || text.includes('\n') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serializeDelimited(snapshot, delimiter, includeHeaders) {
  const data = includeHeaders ? [snapshot.headers, ...snapshot.rows] : snapshot.rows;
  return data.map((row) => row.map((value) => escapeDelimited(value, delimiter)).join(delimiter)).join('\r\n');
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

function serializeMarkdown(snapshot, includeHeaders) {
  if (!includeHeaders) return snapshot.rows.map(markdownRow).join('\n');
  return [
    markdownRow(snapshot.headers),
    markdownRow(snapshot.headers.map(() => '---')),
    ...snapshot.rows.map(markdownRow)
  ].join('\n');
}

async function storageExportOptions() {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_EXPORT_OPTIONS);
    cachedExportOptions = { ...cachedExportOptions, ...stored };
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!message.includes('Extension context invalidated')) throw error;
  }
  return { ...cachedExportOptions };
}

async function exporterOptions(format) {
  const settings = editorSettings();
  const formatState = formatOptions(format);
  const stored = await storageExportOptions();
  const options = { ...formatState, includeHeaders: settings.includeHeaders !== false };

  if (format === 'html') {
    options.includeHeaders = settings.includeHeaders !== false && formatState.includeHeaders !== false;
  }
  if (format === 'xlsx') {
    options.includeHeader = settings.includeHeaders !== false;
    options.autoColumnWidth = stored.xlsxAutoColumnWidth !== false;
    options.wrapText = stored.xlsxWrapText !== false;
    options.autoFilter = stored.xlsxAutoFilter !== false;
  }
  if (format === 'pdf') {
    if (stored.pdfOrientation && stored.pdfOrientation !== 'auto') options.orientation = stored.pdfOrientation;
    options.pageSize = stored.pdfPageSize || 'a4';
  }
  return { options, stored };
}

async function serializeText(format, snapshot) {
  const settings = editorSettings();
  const includeHeaders = settings.includeHeaders !== false;
  const { options, stored } = await exporterOptions(format);

  if (format === 'csv') {
    return `\uFEFF${serializeDelimited(snapshot, stored.csvDelimiter || ',', includeHeaders)}`;
  }
  if (format === 'markdown') return serializeMarkdown(snapshot, includeHeaders);
  if (format === 'tsv') return `\uFEFF${serializeDelimited(snapshot, '\t', includeHeaders)}`;

  const exporter = getExporter(format);
  if (!exporter || exporter.copyable === false || typeof exporter.serialize !== 'function') {
    throw new Error(`Format is not copyable: ${format}`);
  }
  return serializeExport(format, snapshot, options);
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

function outputFilename(format) {
  const meta = FORMAT_META[format] || FORMAT_META.csv;
  return window.__TableSnapEditorSettings?.getFilename?.(meta.extension)
    || `table-export.${meta.extension}`;
}

function createPngTable(snapshot, includeHeaders, keepOriginalFormatting) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;padding:20px;background:#fff;color:#171717;z-index:-1';
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;font:13px Inter,Arial,sans-serif;background:#fff;color:#171717';

  if (includeHeaders) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    snapshot.headers.forEach((value) => {
      const th = document.createElement('th');
      th.textContent = value;
      th.style.cssText = 'padding:8px 10px;border:1px solid #d9dde2;background:#f4f6f8;font-weight:700;text-align:left;vertical-align:top';
      tr.append(th);
    });
    thead.append(tr);
    table.append(thead);
  }

  const tbody = document.createElement('tbody');
  snapshot.rows.forEach((row) => {
    const tr = document.createElement('tr');
    snapshot.headers.forEach((_, index) => {
      const td = document.createElement('td');
      td.textContent = row[index] ?? '';
      td.style.cssText = `padding:8px 10px;border:1px solid #d9dde2;text-align:left;vertical-align:top;white-space:${keepOriginalFormatting ? 'pre-wrap' : 'normal'}`;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  host.append(table);
  document.documentElement.append(host);
  return { host, table };
}

async function createPngBlob(snapshot, settings, scale) {
  const rendered = createPngTable(snapshot, settings.includeHeaders !== false, settings.keepOriginalFormatting !== false);
  try {
    const canvas = await html2canvas(rendered.table, {
      backgroundColor: '#ffffff',
      scale: Number(scale) || 2,
      logging: false,
      useCORS: true
    });
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Failed to create PNG')), 'image/png');
    });
  } finally {
    rendered.host.remove();
  }
}

async function createExportBlob(format, snapshot) {
  const settings = editorSettings();
  const { options, stored } = await exporterOptions(format);

  if (format === 'png') return createPngBlob(snapshot, settings, stored.imageScale);
  if (format === 'csv' || format === 'markdown' || format === 'tsv') {
    const text = await serializeText(format, snapshot);
    return new Blob([text], { type: FORMAT_META[format].mimeType });
  }

  const exporter = getExporter(format);
  if (!exporter) throw new Error(`Unsupported format: ${format}`);
  if (typeof exporter.createBlob === 'function') return exporter.createBlob(snapshot, options);
  return new Blob([serializeExport(format, snapshot, options)], { type: exporter.mimeType });
}

function buttonLabel(button) {
  return button?.querySelector('span:last-child') || button;
}

function flashButton(button, text, duration = 850) {
  const label = buttonLabel(button);
  if (!label) return;
  const original = label.textContent;
  label.textContent = text;
  setTimeout(() => {
    if (label.isConnected) label.textContent = original;
  }, duration);
}

function setExportLoading(button, loading) {
  if (!button) return;
  const label = buttonLabel(button);
  const icon = button.querySelector('.tablesnap-editor-action-icon');

  button.dataset.loading = String(loading);
  if (label) label.textContent = loading ? 'Exporting...' : 'Export';
  if (!icon) return;

  if (loading) {
    if (!icon.dataset.idleMarkup) icon.dataset.idleMarkup = icon.innerHTML;
    icon.classList.add('is-loading');
    icon.innerHTML = '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8"/>';
  } else {
    icon.classList.remove('is-loading');
    if (icon.dataset.idleMarkup) icon.innerHTML = icon.dataset.idleMarkup;
  }
}

function hasSelectedRows(editor) {
  return editor?.querySelector('[data-selection-count]')?.dataset.active === 'true';
}

function updateActionState(editor = activeEditor) {
  if (!editor?.isConnected) return;
  const format = currentFormat();
  const hasRows = hasSelectedRows(editor);
  const copy = editor.querySelector('.tablesnap-editor-secondary');
  const exportButton = editor.querySelector('.tablesnap-editor-primary');
  if (copy) {
    const shouldDisable = busy || !hasRows || NON_COPYABLE.has(format);
    if (copy.disabled !== shouldDisable) copy.disabled = shouldDisable;
    copy.title = NON_COPYABLE.has(format) ? `${format.toUpperCase()} cannot be copied to the clipboard` : 'Copy selected table data';
  }
  if (exportButton) {
    const shouldDisable = busy || !hasRows;
    if (exportButton.disabled !== shouldDisable) exportButton.disabled = shouldDisable;
    exportButton.title = busy ? 'Export in progress' : 'Export selected table data';
  }
}

async function handleCopy(editor, button) {
  if (busy || button.disabled) return;
  busy = true;
  updateActionState(editor);
  try {
    const snapshot = captureEditorSnapshot(editor);
    if (!snapshot.headers.length || !snapshot.rows.length) throw new Error('No selected table data');
    const text = await serializeText(currentFormat(), snapshot);
    await copyText(text);
    flashButton(button, 'Copied');
  } catch (error) {
    console.error('[TableSnap] Editor copy failed:', error);
    flashButton(button, 'Copy failed', 1100);
  } finally {
    busy = false;
    updateActionState(editor);
  }
}

async function handleExport(editor, button) {
  if (busy || button.disabled) return;
  busy = true;
  setExportLoading(button, true);
  updateActionState(editor);
  let result = 'Exported';
  try {
    const format = currentFormat();
    const snapshot = captureEditorSnapshot(editor);
    if (!snapshot.headers.length || !snapshot.rows.length) throw new Error('No selected table data');
    const blob = await createExportBlob(format, snapshot);
    downloadBlob(blob, outputFilename(format));
  } catch (error) {
    result = 'Export failed';
    console.error('[TableSnap] Editor export failed:', error);
  } finally {
    setExportLoading(button, false);
    busy = false;
    updateActionState(editor);
    flashButton(button, result, result === 'Exported' ? 850 : 1100);
  }
}

function setupEditor(editor) {
  if (!editor || editor.dataset.exportIntegrationReady === 'true') return;
  editor.dataset.exportIntegrationReady = 'true';
  activeEditor = editor;

  const copy = editor.querySelector('.tablesnap-editor-secondary');
  const exportButton = editor.querySelector('.tablesnap-editor-primary');
  copy?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleCopy(editor, copy);
  });
  exportButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleExport(editor, exportButton);
  });

  editorObserver?.disconnect();
  const selection = editor.querySelector('[data-selection-count]');
  if (selection) {
    editorObserver = new MutationObserver(() => updateActionState(editor));
    editorObserver.observe(selection, { attributes: true, attributeFilter: ['data-active'] });
  } else {
    editorObserver = null;
  }
  updateActionState(editor);
}

function scan() {
  const editor = document.querySelector(EDITOR_SELECTOR);
  if (editor) setupEditor(editor);
  if (!editor && activeEditor) {
    editorObserver?.disconnect();
    editorObserver = null;
    activeEditor = null;
    busy = false;
  }
}

document.addEventListener('tablesnap:editor-format-change', () => updateActionState());
document.addEventListener('tablesnap:editor-settings-change', () => updateActionState());

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
scan();
