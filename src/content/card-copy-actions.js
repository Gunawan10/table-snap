let tablesnapActiveTable = null;
let tablesnapTheme = 'warm-black';

function tablesnapCleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function tablesnapIsHiddenElement(element) {
  if (!(element instanceof Element)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  const style = getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
}

function tablesnapIsVisibleCell(cell) {
  if (tablesnapIsHiddenElement(cell)) return false;
  const rect = cell.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function tablesnapExtractCellText(cell) {
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
    'img',
    '[role="button"]',
    '[aria-hidden="true"]',
    '[hidden]',
    '.tablesnap-export-icon',
    '.tablesnap-export-card'
  ].join(',')).forEach((node) => node.remove());
  return tablesnapCleanText(clone.textContent || '');
}

function tablesnapGetVisibleRows(table) {
  return [...table.rows].filter((row) => {
    if (tablesnapIsHiddenElement(row)) return false;
    return [...row.cells].some(tablesnapIsVisibleCell);
  });
}

function tablesnapHasVisibleDataRows(table) {
  return [...(table.tBodies || [])].some((tbody) => [...tbody.rows].some((row) => {
    if (tablesnapIsHiddenElement(row)) return false;
    return [...row.cells].some((cell) => tablesnapIsVisibleCell(cell) && tablesnapExtractCellText(cell) !== '');
  }));
}

function tablesnapRowSignature(row) {
  return [...row.cells]
    .filter(tablesnapIsVisibleCell)
    .map((cell) => tablesnapExtractCellText(cell).toLowerCase())
    .join('|');
}

function tablesnapRemoveDuplicateStickyHeaders(table, rows) {
  const headerRows = table.tHead
    ? [...table.tHead.rows].filter((row) => rows.includes(row))
    : rows.filter((row) => [...row.cells].some((cell) => cell.tagName === 'TH'));

  if (!headerRows.length) return rows;

  const headerSignatures = new Set(headerRows.map(tablesnapRowSignature).filter(Boolean));

  return rows.filter((row) => {
    if (headerRows.includes(row)) return true;

    const cells = [...row.cells].filter(tablesnapIsVisibleCell);
    if (!cells.length) return false;

    const signature = tablesnapRowSignature(row);
    if (!signature || !headerSignatures.has(signature)) return true;

    const marker = `${row.id} ${row.className} ${row.parentElement?.id || ''} ${row.parentElement?.className || ''}`.toLowerCase();
    const headerLike = cells.every((cell) => cell.tagName === 'TH') || row.getAttribute('role') === 'rowheader';
    const stickyLike = /sticky|clone|cloned|floating|frozen|fixed|header/.test(marker);

    return !(headerLike || stickyLike);
  });
}

function tablesnapBuildGrid(rows) {
  const grid = [];
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let columnIndex = 0;
    [...row.cells].filter(tablesnapIsVisibleCell).forEach((cell) => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex += 1;
      const rowspan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') || '1', 10));
      const colspan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10));
      const entry = { text: tablesnapExtractCellText(cell) };
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        grid[targetRow] ||= [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          grid[targetRow][columnIndex + columnOffset] = entry;
        }
      }
      columnIndex += colspan;
    });
  });
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null));
}

function tablesnapHeaderCount(table, rows) {
  if (table.tHead?.rows.length) return [...table.tHead.rows].filter((row) => rows.includes(row)).length;
  let count = 0;
  for (const row of rows) {
    const cells = [...row.cells].filter(tablesnapIsVisibleCell);
    if (!cells.length || !cells.some((cell) => cell.tagName === 'TH')) break;
    count += 1;
  }
  return count;
}

function tablesnapIsMergedHeaderColumn(grid, headerCount, column) {
  for (let row = 0; row < headerCount; row += 1) {
    const entry = grid[row]?.[column];
    if (!entry) continue;
    if (grid[row]?.[column - 1] === entry || grid[row]?.[column + 1] === entry) return true;
  }
  return false;
}

function tablesnapCompactDecorativeColumns(grid, headerCount, headers, rows) {
  if (!headers.length || !rows.length) return { headers, rows };

  const keepColumns = headers.map((header, column) => {
    const hasBodyText = rows.some((row) => tablesnapCleanText(row[column] || '') !== '');
    if (hasBodyText) return true;

    if (!tablesnapIsMergedHeaderColumn(grid, headerCount, column)) return true;

    const sameHeaderLeft = column > 0 && headers[column - 1] === header;
    const sameHeaderRight = column < headers.length - 1 && headers[column + 1] === header;
    return !(sameHeaderLeft || sameHeaderRight);
  });

  return {
    headers: headers.filter((_, column) => keepColumns[column]),
    rows: rows.map((row) => row.filter((_, column) => keepColumns[column]))
  };
}

function tablesnapParseTable(table) {
  const visibleRows = tablesnapGetVisibleRows(table);
  const rows = tablesnapRemoveDuplicateStickyHeaders(table, visibleRows);
  const grid = tablesnapBuildGrid(rows);
  if (!grid.length) return { headers: [], rows: [] };

  const headerCount = tablesnapHeaderCount(table, rows);
  const headers = Array.from({ length: grid[0].length }, (_, column) => {
    const parts = [];
    let previous = null;
    for (let row = 0; row < headerCount; row += 1) {
      const entry = grid[row]?.[column];
      if (!entry || entry === previous || !entry.text) continue;
      if (parts.at(-1) !== entry.text) parts.push(entry.text);
      previous = entry;
    }
    return parts.join(' / ') || `Column ${column + 1}`;
  });

  const dataRows = grid.slice(headerCount).map((row) => row.map((entry) => entry?.text ?? ''));
  return tablesnapCompactDecorativeColumns(grid, headerCount, headers, dataRows);
}

function tablesnapEscapeCsv(value, delimiter) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  return text.includes('"') || text.includes('\n') || text.includes(delimiter)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function tablesnapToCsv(parsed, delimiter) {
  return [parsed.headers, ...parsed.rows]
    .map((row) => row.map((value) => tablesnapEscapeCsv(value, delimiter)).join(delimiter))
    .join('\r\n');
}

function tablesnapEscapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\r\n?|\n/g, '<br>')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .trim();
}

function tablesnapMarkdownRow(values) {
  return `| ${values.map(tablesnapEscapeMarkdown).join(' | ')} |`;
}

function tablesnapToMarkdown(parsed) {
  return [
    tablesnapMarkdownRow(parsed.headers),
    tablesnapMarkdownRow(parsed.headers.map(() => '---')),
    ...parsed.rows.map(tablesnapMarkdownRow)
  ].join('\n');
}

async function tablesnapCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.documentElement.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function tablesnapFindTableForIcon(icon) {
  const iconRect = icon.getBoundingClientRect();
  const x = iconRect.left + iconRect.width / 2;
  const y = iconRect.top + iconRect.height / 2;
  const candidates = [...document.querySelectorAll('table')].filter((table) => {
    const rect = table.getBoundingClientRect();
    return x >= rect.left - 12 && x <= rect.right + 12 && y >= rect.top - 12 && y <= rect.bottom + 12;
  });
  return candidates.sort((a, b) => {
    const aHasData = tablesnapHasVisibleDataRows(a) ? 1 : 0;
    const bHasData = tablesnapHasVisibleDataRows(b) ? 1 : 0;
    if (aHasData !== bHasData) return bHasData - aHasData;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0] || null;
}

function downloadSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"/></svg>';
}

function copySvg(type) {
  if (type === 'csv') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 15h5M10 18h3"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12v6m0-6 2 3 2-3v6"/></svg>';
}

function tablesnapDecoratePrimaryActions(card) {
  card.querySelectorAll('.tablesnap-card-actions button').forEach((button) => {
    if (button.querySelector('.tablesnap-download-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'tablesnap-download-icon';
    icon.innerHTML = downloadSvg();
    button.append(icon);
  });
}

function tablesnapAddCopyActions(card) {
  if (card.querySelector('.tablesnap-copy-actions')) return;
  card.dataset.theme = tablesnapTheme;
  tablesnapDecoratePrimaryActions(card);
  const actions = document.createElement('div');
  actions.className = 'tablesnap-copy-actions';
  actions.innerHTML = `
    <button type="button" data-copy="csv"><span class="copy-icon csv-copy">${copySvg('csv')}</span><span class="copy-label"><strong>Copy as CSV</strong><small>Copy to clipboard</small></span></button>
    <button type="button" data-copy="markdown"><span class="copy-icon md-copy">${copySvg('markdown')}</span><span class="copy-label"><strong>Copy as Markdown</strong><small>Copy to clipboard</small></span></button>`;
  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button || !tablesnapActiveTable) return;
    const parsed = tablesnapParseTable(tablesnapActiveTable);
    const { csvDelimiter = ',' } = await chrome.storage.local.get({ csvDelimiter: ',' });
    const text = button.dataset.copy === 'csv'
      ? tablesnapToCsv(parsed, csvDelimiter)
      : tablesnapToMarkdown(parsed);
    await tablesnapCopy(text);
    const strong = button.querySelector('strong');
    const original = strong.textContent;
    button.dataset.copied = 'true';
    strong.textContent = 'Copied';
    setTimeout(() => {
      button.dataset.copied = 'false';
      strong.textContent = original;
    }, 1200);
  });
  card.append(actions);
}

document.addEventListener('click', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (icon) tablesnapActiveTable = tablesnapFindTableForIcon(icon);
}, true);

const tablesnapCardObserver = new MutationObserver(() => {
  document.querySelectorAll('.tablesnap-export-card').forEach(tablesnapAddCopyActions);
});

tablesnapCardObserver.observe(document.documentElement, { childList: true, subtree: true });

chrome.storage.local.get({ theme: 'warm-black' }).then(({ theme }) => {
  tablesnapTheme = theme;
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => { card.dataset.theme = theme; });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.theme) return;
  tablesnapTheme = changes.theme.newValue || 'warm-black';
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => { card.dataset.theme = tablesnapTheme; });
});
