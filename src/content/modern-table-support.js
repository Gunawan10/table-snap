import html2canvas from 'html2canvas';

const MIN_WIDTH = 48;
const MIN_HEIGHT = 32;
const MIN_ROWS = 2;
const MIN_COLUMNS = 2;

let settings = {
  iconVisibility: 'hover',
  iconPosition: 'top-right',
  iconSize: 'small',
  csvDelimiter: ',',
  imageScale: 2
};

let activeCard = null;
let activeRoot = null;
const attached = new WeakSet();
const controls = new Map();

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function isHidden(element) {
  if (!(element instanceof Element)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  const style = getComputedStyle(element);
  return style.display === 'none'
    || style.visibility === 'hidden'
    || style.visibility === 'collapse';
}

function isVisible(element) {
  if (!(element instanceof Element) || isHidden(element)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
}

function isNativeTable(element) {
  return element instanceof HTMLTableElement || Boolean(element.closest('table'));
}

function directOwnedDescendants(root, selector, boundarySelector) {
  return [...root.querySelectorAll(selector)].filter((element) => {
    const owner = element.parentElement?.closest(boundarySelector);
    return owner === root;
  });
}

function ariaRows(root) {
  return directOwnedDescendants(
    root,
    '[role="row"]',
    '[role="table"], [role="grid"], [role="treegrid"]'
  ).filter((row) => !isHidden(row));
}

function ariaCells(row) {
  return [...row.querySelectorAll(':scope > [role="columnheader"], :scope > [role="rowheader"], :scope > [role="cell"], :scope > [role="gridcell"]')]
    .filter((cell) => !isHidden(cell));
}

function ariaConfidence(root) {
  if (isNativeTable(root) || !isVisible(root)) return 0;
  const rows = ariaRows(root);
  if (rows.length < MIN_ROWS) return 0;

  const counts = rows.map((row) => ariaCells(row).length).filter(Boolean);
  if (counts.length < MIN_ROWS || Math.max(...counts) < MIN_COLUMNS) return 0;

  let score = 4;
  if (root.matches('[role="grid"], [role="treegrid"]')) score += 1;
  if (rows.some((row) => ariaCells(row).some((cell) => cell.getAttribute('role') === 'columnheader'))) score += 2;
  if (counts.every((count) => count === counts[0])) score += 1;
  if (root.hasAttribute('aria-rowcount') || root.hasAttribute('aria-colcount')) score += 1;
  return score;
}

function markerText(element) {
  return `${element.id || ''} ${element.className || ''}`.toLowerCase();
}

function looksTableNamed(element) {
  return /(^|[\s_-])(table|datatable|data-table|data_grid|data-grid|grid)([\s_-]|$)/.test(markerText(element));
}

function candidateDivRows(root) {
  const children = [...root.children].filter((child) => !isHidden(child));
  const rowLike = children.filter((child) => {
    const marker = markerText(child);
    const role = child.getAttribute('role');
    return role === 'row' || /(^|[\s_-])(row|table-row|grid-row)([\s_-]|$)/.test(marker);
  });
  return rowLike.length >= MIN_ROWS ? rowLike : [];
}

function divRowCells(row) {
  return [...row.children].filter((child) => {
    if (isHidden(child)) return false;
    const role = child.getAttribute('role');
    if (['cell', 'gridcell', 'columnheader', 'rowheader'].includes(role)) return true;
    return /(^|[\s_-])(cell|column|col|table-cell|grid-cell)([\s_-]|$)/.test(markerText(child));
  });
}

function divConfidence(root) {
  if (isNativeTable(root) || !isVisible(root) || !looksTableNamed(root)) return 0;
  const rows = candidateDivRows(root);
  if (rows.length < MIN_ROWS) return 0;
  const counts = rows.map((row) => divRowCells(row).length);
  if (counts.some((count) => count < MIN_COLUMNS)) return 0;
  if (Math.max(...counts) - Math.min(...counts) > 1) return 0;
  return counts.every((count) => count === counts[0]) ? 5 : 4;
}

function splitGridTracks(value) {
  const text = String(value || '').trim();
  if (!text || text === 'none') return [];
  const tracks = [];
  let token = '';
  let depth = 0;

  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (token) tracks.push(token);
      token = '';
    } else {
      token += char;
    }
  }
  if (token) tracks.push(token);
  return tracks;
}

function cssGridColumnCount(root) {
  const style = getComputedStyle(root);
  if (!['grid', 'inline-grid'].includes(style.display)) return 0;
  return splitGridTracks(style.gridTemplateColumns).length;
}

function cssGridConfidence(root) {
  if (isNativeTable(root) || !isVisible(root)) return 0;
  const columns = cssGridColumnCount(root);
  if (columns < MIN_COLUMNS) return 0;

  const children = [...root.children].filter((child) => !isHidden(child));
  if (children.length < columns * MIN_ROWS || children.length % columns !== 0) return 0;

  let score = looksTableNamed(root) ? 5 : 3;
  const markerMatches = children.filter((child) => /(cell|column|row)/.test(markerText(child))).length;
  if (markerMatches >= Math.ceil(children.length / 2)) score += 1;
  return score;
}

function getModernType(root) {
  if (ariaConfidence(root) >= 4) return 'aria';
  if (divConfidence(root) >= 4) return 'div';
  if (cssGridConfidence(root) >= 4) return 'css-grid';
  return null;
}

function cellText(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll([
    'script', 'style', 'noscript', 'svg', 'canvas', 'button', 'input', 'select', 'textarea', 'img',
    '[role="button"]', '[aria-hidden="true"]', '[hidden]', '.tablesnap-export-icon', '.tablesnap-modern-export-card'
  ].join(',')).forEach((node) => node.remove());
  return cleanText(clone.textContent || '');
}

function normalizeMatrix(matrix) {
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  return matrix.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

function parseAria(root) {
  const rows = ariaRows(root);
  const matrix = normalizeMatrix(rows.map((row) => ariaCells(row).map(cellText)));
  if (!matrix.length) return { headers: [], rows: [] };

  const headerIndex = rows.findIndex((row) => ariaCells(row).some((cell) => cell.getAttribute('role') === 'columnheader'));
  if (headerIndex >= 0) {
    const headers = matrix[headerIndex].map((value, index) => value || `Column ${index + 1}`);
    return { headers, rows: matrix.filter((_, index) => index !== headerIndex) };
  }

  return {
    headers: matrix[0].map((_, index) => `Column ${index + 1}`),
    rows: matrix
  };
}

function parseDiv(root) {
  const rows = candidateDivRows(root);
  const matrix = normalizeMatrix(rows.map((row) => divRowCells(row).map(cellText)));
  if (!matrix.length) return { headers: [], rows: [] };

  const firstCells = divRowCells(rows[0]);
  const headerLike = firstCells.some((cell) => {
    const role = cell.getAttribute('role');
    return role === 'columnheader' || /header|heading|column-title/.test(markerText(cell));
  });

  if (headerLike) {
    return {
      headers: matrix[0].map((value, index) => value || `Column ${index + 1}`),
      rows: matrix.slice(1)
    };
  }

  return {
    headers: matrix[0].map((_, index) => `Column ${index + 1}`),
    rows: matrix
  };
}

function parseCssGrid(root) {
  const columns = cssGridColumnCount(root);
  const cells = [...root.children].filter((child) => !isHidden(child));
  const matrix = [];
  for (let index = 0; index < cells.length; index += columns) {
    matrix.push(cells.slice(index, index + columns).map(cellText));
  }

  const normalized = normalizeMatrix(matrix);
  if (!normalized.length) return { headers: [], rows: [] };
  const firstRowCells = cells.slice(0, columns);
  const headerLike = firstRowCells.some((cell) => /header|heading|column-title/.test(markerText(cell)));

  if (headerLike) {
    return {
      headers: normalized[0].map((value, index) => value || `Column ${index + 1}`),
      rows: normalized.slice(1)
    };
  }

  return {
    headers: normalized[0].map((_, index) => `Column ${index + 1}`),
    rows: normalized
  };
}

function parseModernTable(root) {
  const type = getModernType(root);
  if (type === 'aria') return parseAria(root);
  if (type === 'div') return parseDiv(root);
  if (type === 'css-grid') return parseCssGrid(root);
  return { headers: [], rows: [] };
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

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'table';
}

function labelFor(root) {
  const ariaLabel = cleanText(root.getAttribute('aria-label') || '');
  if (ariaLabel) return ariaLabel;

  const labelledBy = root.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy.split(/\s+/)
      .map((id) => cleanText(document.getElementById(id)?.textContent || ''))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  let node = root;
  for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) return cleanText(sibling.textContent || '');
      const heading = sibling.querySelector?.('h1, h2, h3, h4, h5, h6');
      if (heading) return cleanText(heading.textContent || '');
      sibling = sibling.previousElementSibling;
    }
  }

  return cleanText(document.title || '') || 'table';
}

function filename(root, extension) {
  return `table-${slugify(labelFor(root))}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
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

async function exportModern(root, format) {
  if (format === 'image') {
    const canvas = await html2canvas(root, {
      backgroundColor: null,
      scale: settings.imageScale,
      useCORS: true,
      logging: false,
      onclone: (doc) => doc.querySelectorAll('.tablesnap-export-icon, .tablesnap-modern-export-card').forEach((node) => node.remove())
    });
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Failed to create PNG')), 'image/png');
    });
    return downloadBlob(blob, filename(root, 'png'));
  }

  const parsed = parseModernTable(root);
  if (!parsed.headers.length) throw new Error('No table data detected');

  if (format === 'markdown') {
    return downloadBlob(new Blob([toMarkdown(parsed)], { type: 'text/markdown;charset=utf-8' }), filename(root, 'md'));
  }

  const csv = `\uFEFF${toCsv(parsed, settings.csvDelimiter)}`;
  return downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename(root, 'csv'));
}

function logoSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="11" rx="1"/><path d="M5 11h14M9 7v11M15 7v11M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>';
}

function closeCard() {
  activeCard?.remove();
  activeCard = null;
  activeRoot = null;
}

function createCard(root) {
  const card = document.createElement('div');
  card.className = 'tablesnap-modern-export-card';
  card.innerHTML = `
    <style>
      .tablesnap-modern-export-card{position:absolute;z-index:2147483647;width:min(360px,calc(100vw - 24px));padding:14px;background:#171717;color:#f5f5f5;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 18px 48px rgba(0,0,0,.28);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .tablesnap-modern-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.tablesnap-modern-head svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7}.tablesnap-modern-head strong{display:block;font-size:14px}.tablesnap-modern-head span{display:block;color:#a3a3a3;font-size:12px}
      .tablesnap-modern-actions{display:grid;gap:7px}.tablesnap-modern-actions button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;background:#222;color:inherit;border:1px solid rgba(255,255,255,.08);border-radius:12px;text-align:left;cursor:pointer}.tablesnap-modern-actions button:hover{background:#292929}.tablesnap-modern-actions b{min-width:42px;font-size:11px}.tablesnap-modern-actions strong{display:block;font-size:12px}.tablesnap-modern-actions small{display:block;color:#a3a3a3;font-size:11px}.tablesnap-modern-copy{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.tablesnap-modern-copy button{padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#202020;color:inherit;cursor:pointer;font-size:11px}
    </style>
    <div class="tablesnap-modern-head"><span>${logoSvg()}</span><div><strong>TableSnap</strong><span>Modern table detected</span></div></div>
    <div class="tablesnap-modern-actions">
      <button type="button" data-modern-format="csv"><b>CSV</b><span><strong>Save as CSV</strong><small>Spreadsheet-friendly data</small></span></button>
      <button type="button" data-modern-format="markdown"><b>MD</b><span><strong>Save as Markdown</strong><small>For docs and notes</small></span></button>
      <button type="button" data-modern-format="image"><b>PNG</b><span><strong>Save as Image</strong><small>Keep visual appearance</small></span></button>
    </div>
    <div class="tablesnap-modern-copy">
      <button type="button" data-modern-copy="csv">Copy CSV</button>
      <button type="button" data-modern-copy="markdown">Copy Markdown</button>
    </div>`;

  card.addEventListener('click', async (event) => {
    const exportButton = event.target.closest('[data-modern-format]');
    if (exportButton) {
      exportButton.disabled = true;
      try {
        await exportModern(root, exportButton.dataset.modernFormat);
        exportButton.querySelector('strong').textContent = 'Saved';
        setTimeout(closeCard, 650);
      } catch (error) {
        exportButton.disabled = false;
        console.error('[TableSnap] Modern table export failed:', error);
      }
      return;
    }

    const copyButton = event.target.closest('[data-modern-copy]');
    if (!copyButton) return;
    const parsed = parseModernTable(root);
    const text = copyButton.dataset.modernCopy === 'csv'
      ? toCsv(parsed, settings.csvDelimiter)
      : toMarkdown(parsed);
    await copyText(text);
    const original = copyButton.textContent;
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = original; }, 1000);
  });

  document.documentElement.append(card);
  return card;
}

function positionCard(card, root) {
  const rect = root.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  card.style.left = `${Math.max(window.scrollX + 12, Math.min(window.scrollX + rect.right - width, window.scrollX + window.innerWidth - width - 12))}px`;
  card.style.top = `${window.scrollY + rect.top + 48}px`;
}

function openCard(root) {
  if (activeCard && activeRoot === root) return closeCard();
  closeCard();
  activeRoot = root;
  activeCard = createCard(root);
  positionCard(activeCard, root);
}

function createIcon(root) {
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = `tablesnap-export-icon size-${settings.iconSize}`;
  icon.setAttribute('aria-label', 'Export modern table with TableSnap');
  icon.dataset.tablesnapModern = 'true';
  icon.innerHTML = logoSvg();
  document.documentElement.append(icon);

  const updatePosition = () => {
    if (!root.isConnected) return;
    const rect = root.getBoundingClientRect();
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
    if (settings.iconVisibility === 'hover' && !root.contains(event.relatedTarget)) setVisible(false);
  };

  icon.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCard(root);
  });
  root.addEventListener('mouseenter', enter);
  root.addEventListener('mouseleave', leave);
  icon.addEventListener('mouseleave', iconLeave);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
  updatePosition();

  return {
    destroy() {
      root.removeEventListener('mouseenter', enter);
      root.removeEventListener('mouseleave', leave);
      icon.removeEventListener('mouseleave', iconLeave);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      icon.remove();
    }
  };
}

function attach(root) {
  if (attached.has(root) || !getModernType(root)) return;
  attached.add(root);
  controls.set(root, createIcon(root));
}

function scan(root = document) {
  const candidates = [];
  if (root instanceof Element) candidates.push(root);
  candidates.push(...(root.querySelectorAll?.('[role="table"], [role="grid"], [role="treegrid"], div, section') || []));

  candidates.forEach((candidate) => {
    if (candidate.closest('table')) return;
    if (getModernType(candidate)) attach(candidate);
  });
}

function observe() {
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

function refreshControls() {
  closeCard();
  for (const [root, control] of [...controls.entries()]) {
    control.destroy();
    controls.delete(root);
    if (root.isConnected && getModernType(root)) controls.set(root, createIcon(root));
  }
}

window.__TableSnapModern = {
  getModernType,
  parseModernTable,
  ariaConfidence,
  divConfidence,
  cssGridConfidence
};

(async function initModernTableSupport() {
  settings = { ...settings, ...(await chrome.storage.local.get(settings)) };
  observe();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let needsRefresh = false;
    for (const key of ['iconVisibility', 'iconPosition', 'iconSize']) {
      if (changes[key]) needsRefresh = true;
    }
    Object.entries(changes).forEach(([key, value]) => {
      settings[key] = value.newValue;
    });
    if (needsRefresh) refreshControls();
  });

  document.addEventListener('pointerdown', (event) => {
    if (activeCard && !activeCard.contains(event.target) && !event.target.closest('[data-tablesnap-modern="true"]')) {
      closeCard();
    }
  }, true);
})();
