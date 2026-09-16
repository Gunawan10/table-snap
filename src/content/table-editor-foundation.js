const EDITOR_SELECTOR = '.tablesnap-table-editor';
const SOURCE_CARD_SELECTOR = '.tablesnap-export-card, .tablesnap-modern-export-card';

let editor = null;
let sourceCard = null;
let sourceIcon = null;
let suppressIconHandling = false;

function closeEditorOnly() {
  editor?.remove();
  editor = null;
  sourceCard = null;
  sourceIcon = null;
  document.documentElement.classList.remove('tablesnap-editor-open');
}

function closeThroughSourceIcon() {
  if (!editor) return;

  const icon = sourceIcon;
  if (icon?.isConnected) {
    suppressIconHandling = true;
    icon.click();
    suppressIconHandling = false;
    return;
  }

  sourceCard?.remove();
  closeEditorOnly();
}

function createSection(title, description) {
  return `
    <section class="tablesnap-editor-section">
      <div class="tablesnap-editor-section-head">
        <strong>${title}</strong>
        <span>${description}</span>
      </div>
      <div class="tablesnap-editor-section-placeholder" aria-hidden="true">
        <span></span><span></span>
      </div>
    </section>`;
}

function createEditor() {
  const root = document.createElement('div');
  root.className = 'tablesnap-table-editor';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Table Editor');
  root.innerHTML = `
    <div class="tablesnap-editor-backdrop" data-editor-close></div>
    <div class="tablesnap-editor-dialog">
      <header class="tablesnap-editor-header">
        <div class="tablesnap-editor-heading">
          <div class="tablesnap-editor-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 5.5h16v13H4zM4 10h16M9 5.5v13"/></svg>
          </div>
          <div>
            <strong>Table Editor</strong>
            <span>Clean and prepare your table before export</span>
          </div>
        </div>
        <button type="button" class="tablesnap-editor-close" data-editor-close aria-label="Close Table Editor">
          <svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>
        </button>
      </header>

      <div class="tablesnap-editor-body">
        <main class="tablesnap-editor-workspace">
          <div class="tablesnap-editor-workspace-head">
            <div>
              <strong>Table Preview</strong>
              <span>Review the captured table before export</span>
            </div>
            <div class="tablesnap-editor-search-placeholder" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
              <span>Search table...</span>
            </div>
          </div>
          <div class="tablesnap-editor-preview-empty">
            <div class="tablesnap-editor-preview-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg>
            </div>
            <strong>Table preview</strong>
            <span>Captured rows and columns will appear here in the next step.</span>
          </div>
        </main>

        <aside class="tablesnap-editor-sidebar">
          ${createSection('Columns', 'Show, rename, and reorder')}
          ${createSection('Data Cleanup', 'Clean captured values')}
          ${createSection('Content', 'Links and formatting')}
          ${createSection('File Settings', 'Filename and headers')}
          ${createSection('Format Settings', 'Options for the selected format')}
        </aside>
      </div>

      <footer class="tablesnap-editor-footer">
        <label class="tablesnap-editor-format">
          <span>Format</span>
          <select disabled aria-label="Export format">
            <option>CSV</option>
          </select>
        </label>
        <div class="tablesnap-editor-footer-actions">
          <button type="button" class="tablesnap-editor-secondary" disabled>Copy</button>
          <button type="button" class="tablesnap-editor-primary" disabled>Export</button>
        </div>
      </footer>
    </div>`;

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-editor-close]')) closeThroughSourceIcon();
  });

  return root;
}

function openEditor(card) {
  sourceCard = card;
  sourceCard.style.setProperty('display', 'none', 'important');
  sourceIcon = document.querySelector('.tablesnap-export-icon[data-card-open="true"]') || sourceIcon;

  if (editor?.isConnected) return;

  editor = createEditor();
  document.documentElement.append(editor);
  document.documentElement.classList.add('tablesnap-editor-open');
  requestAnimationFrame(() => editor?.classList.add('is-open'));
  editor.querySelector('.tablesnap-editor-close')?.focus({ preventScroll: true });
}

function findSourceCard() {
  return [...document.querySelectorAll(SOURCE_CARD_SELECTOR)]
    .find((card) => !card.closest(EDITOR_SELECTOR));
}

document.addEventListener('pointerdown', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (icon) sourceIcon = icon;
}, true);

document.addEventListener('click', (event) => {
  if (suppressIconHandling || !editor) return;
  const icon = event.target.closest?.('.tablesnap-export-icon');
  if (!icon || icon !== sourceIcon) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  closeThroughSourceIcon();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editor) {
    event.preventDefault();
    closeThroughSourceIcon();
  }
});

const tableEditorObserver = new MutationObserver(() => {
  const card = findSourceCard();

  if (card) {
    if (card !== sourceCard) openEditor(card);
    return;
  }

  if (editor && sourceCard && !sourceCard.isConnected) closeEditorOnly();
});

tableEditorObserver.observe(document.documentElement, { childList: true, subtree: true });
