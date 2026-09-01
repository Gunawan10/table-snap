let tablesnapActiveTable = null;
let tablesnapTheme = 'system';

function tablesnapCleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function tablesnapBuildGrid(rows) {
  const grid = [];
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let columnIndex = 0;
    [...row.cells].forEach((cell) => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex += 1;
      const rowspan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') || '1', 10));
      const colspan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10));
      const entry = { text: tablesnapCleanText(cell.innerText || cell.textContent || '') };
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
  if (table.tHead?.rows.length) return table.tHead.rows.length;
  let count = 0;
  for (const row of rows) {
    const cells = [...row.cells];
    if (!cells.length || !cells.some((cell) => cell.tagName === 'TH')) break;
    count += 1;
  }
  return count;
}

function tablesnapParseTable(table) {
  const rows = [...table.rows];
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
  return {
    headers,
    rows: grid.slice(headerCount).map((row) => row.map((entry) => entry?.text ?? ''))
  };
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
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0] || null;
}

function tablesnapAddCopyActions(card) {
  if (card.querySelector('.tablesnap-copy-actions')) return;
  card.dataset.theme = tablesnapTheme;
  const actions = document.createElement('div');
  actions.className = 'tablesnap-copy-actions';
  actions.innerHTML = `
    <button type="button" data-copy="csv"><span>▤</span><span>Copy as CSV</span></button>
    <button type="button" data-copy="markdown"><span>▧</span><span>Copy as MD</span></button>`;
  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button || !tablesnapActiveTable) return;
    const parsed = tablesnapParseTable(tablesnapActiveTable);
    const { csvDelimiter = ',' } = await chrome.storage.local.get({ csvDelimiter: ',' });
    const text = button.dataset.copy === 'csv'
      ? tablesnapToCsv(parsed, csvDelimiter)
      : tablesnapToMarkdown(parsed);
    await tablesnapCopy(text);
    const original = button.querySelector('span:last-child').textContent;
    button.dataset.copied = 'true';
    button.querySelector('span:last-child').textContent = 'Copied';
    setTimeout(() => {
      button.dataset.copied = 'false';
      button.querySelector('span:last-child').textContent = original;
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

chrome.storage.local.get({ theme: 'system' }).then(({ theme }) => {
  tablesnapTheme = theme;
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => { card.dataset.theme = theme; });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.theme) return;
  tablesnapTheme = changes.theme.newValue || 'system';
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => { card.dataset.theme = tablesnapTheme; });
});
