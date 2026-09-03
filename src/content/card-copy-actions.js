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

    const parsed = core.parseTable(tablesnapActiveTable);
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
