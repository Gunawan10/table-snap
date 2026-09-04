let tablesnapActiveTable = null;
let tablesnapTheme = 'warm-black';

function downloadSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"/></svg>';
}

function copySvg(type) {
  if (type === 'csv') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 15h5M10 18h3"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12v6m0-6 2 3 2-3v6"/></svg>';
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
    return x >= rect.left - 16 && x <= rect.right + 16 && y >= rect.top - 16 && y <= rect.bottom + 16;
  });

  if (!candidates.length) return null;

  const presentation = candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0];

  return window.__TableSnapCore?.resolveDataTable?.(presentation) || presentation;
}

function tablesnapVisibleCells(row) {
  return [...row.cells].filter((cell) => {
    const style = getComputedStyle(cell);
    const rect = cell.getBoundingClientRect();
    return !cell.hidden
      && cell.getAttribute('aria-hidden') !== 'true'
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.visibility !== 'collapse'
      && rect.width > 0
      && rect.height > 0;
  });
}

function tablesnapNumericWeight(value) {
  if (value === 'bold') return 700;
  if (value === 'normal') return 400;
  const parsed = Number.parseInt(value || '400', 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

function tablesnapVisualHeaderScore(firstRow, secondRow) {
  const firstCells = tablesnapVisibleCells(firstRow);
  const secondCells = tablesnapVisibleCells(secondRow);
  if (!firstCells.length || firstCells.length !== secondCells.length) return 0;

  let score = 0;
  const marker = `${firstRow.id} ${firstRow.className} ${firstCells.map((cell) => `${cell.id} ${cell.className}`).join(' ')}`.toLowerCase();
  if (/(^|[\s_-])(header|head|heading|column-title|labels?)([\s_-]|$)/.test(marker)) score += 3;

  const semanticHeader = firstRow.getAttribute('role') === 'columnheader'
    || firstCells.some((cell) => cell.getAttribute('role') === 'columnheader' || cell.getAttribute('scope') === 'col');
  if (semanticHeader) score += 3;

  let heavier = 0;
  let differentBackground = 0;
  let largerText = 0;

  firstCells.forEach((cell, index) => {
    const firstStyle = getComputedStyle(cell);
    const secondStyle = getComputedStyle(secondCells[index]);

    const firstWeight = tablesnapNumericWeight(firstStyle.fontWeight);
    const secondWeight = tablesnapNumericWeight(secondStyle.fontWeight);
    if (firstWeight >= 600 && firstWeight >= secondWeight + 100) heavier += 1;

    const firstBg = firstStyle.backgroundColor;
    const secondBg = secondStyle.backgroundColor;
    if (firstBg !== secondBg && firstBg !== 'rgba(0, 0, 0, 0)' && firstBg !== 'transparent') differentBackground += 1;

    const firstSize = Number.parseFloat(firstStyle.fontSize || '0');
    const secondSize = Number.parseFloat(secondStyle.fontSize || '0');
    if (firstSize >= secondSize + 1) largerText += 1;
  });

  const majority = Math.ceil(firstCells.length / 2);
  if (heavier >= majority) score += 1;
  if (differentBackground >= majority) score += 1;
  if (largerText >= majority) score += 1;

  return score;
}

function tablesnapApplyVisualHeader(table, parsed) {
  if (!table || !parsed?.headers?.length || !parsed?.rows?.length) return parsed;
  if (!parsed.headers.every((header, index) => header === `Column ${index + 1}`)) return parsed;

  const bodyRows = [...table.tBodies]
    .flatMap((tbody) => [...tbody.rows])
    .filter((row) => tablesnapVisibleCells(row).length);

  if (bodyRows.length < 2) return parsed;
  if (tablesnapVisualHeaderScore(bodyRows[0], bodyRows[1]) < 2) return parsed;

  const inferredHeaders = parsed.rows[0].map((value, index) => {
    const text = String(value ?? '').trim();
    return text || `Column ${index + 1}`;
  });

  return {
    headers: inferredHeaders,
    rows: parsed.rows.slice(1)
  };
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
    <button type="button" data-copy="csv">
      <span class="copy-icon csv-copy">${copySvg('csv')}</span>
      <span class="copy-label"><strong>Copy as CSV</strong><small>Copy to clipboard</small></span>
    </button>
    <button type="button" data-copy="markdown">
      <span class="copy-icon md-copy">${copySvg('markdown')}</span>
      <span class="copy-label"><strong>Copy as Markdown</strong><small>Copy to clipboard</small></span>
    </button>`;

  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button || !tablesnapActiveTable) return;

    const core = window.__TableSnapCore;
    if (!core?.parseTable) return;

    const parsed = tablesnapApplyVisualHeader(
      tablesnapActiveTable,
      core.parseTable(tablesnapActiveTable)
    );
    const { csvDelimiter = ',' } = await chrome.storage.local.get({ csvDelimiter: ',' });

    const text = button.dataset.copy === 'csv'
      ? core.toCsv(parsed, csvDelimiter)
      : core.toMarkdown(parsed);

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
  if (!icon) return;
  tablesnapActiveTable = tablesnapFindTableForIcon(icon);
}, true);

const tablesnapCardObserver = new MutationObserver(() => {
  document.querySelectorAll('.tablesnap-export-card').forEach(tablesnapAddCopyActions);
});

tablesnapCardObserver.observe(document.documentElement, { childList: true, subtree: true });

chrome.storage.local.get({ theme: 'warm-black' }).then(({ theme }) => {
  tablesnapTheme = theme;
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => {
    card.dataset.theme = theme;
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.theme) return;
  tablesnapTheme = changes.theme.newValue || 'warm-black';
  document.querySelectorAll('.tablesnap-export-card').forEach((card) => {
    card.dataset.theme = tablesnapTheme;
  });
});
