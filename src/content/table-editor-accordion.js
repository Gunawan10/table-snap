(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SECTION_SELECTOR = '.tablesnap-editor-sidebar > .tablesnap-editor-section';
  const DEFAULT_EXPANDED = new Set(['Columns']);
  const SECTION_ICONS = {
    Columns: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12M12 4v12"/></svg>',
    'Data Cleanup': '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 14 5-5 3 3-5 5H5zM10 9l2-2 3 3-2 2"/><path d="M14.5 3.5v2M13.5 4.5h2M5 4v2M4 5h2"/></svg>',
    Content: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 6.5 6.5 5A3 3 0 0 0 2.3 9.3L5 12a3 3 0 0 0 4.2 0l1.2-1.2"/><path d="m12 13.5 1.5 1.5a3 3 0 0 0 4.2-4.3L15 8a3 3 0 0 0-4.2 0L9.6 9.2"/></svg>',
    'File Settings': '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4v11H5zM11 2.5v4h4"/><circle cx="10" cy="12" r="2.2"/><path d="M10 8.8v1M10 14.2v1M6.8 12h1M12.2 12h1"/></svg>',
    'Format Settings': '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6 3 10l3.5 4M13.5 6 17 10l-3.5 4M11.5 4l-3 12"/></svg>'
  };

  let activeEditor = null;
  const sectionState = new Map();

  function sectionTitle(section) {
    return section.querySelector('.tablesnap-editor-section-head strong')?.textContent?.trim() || '';
  }

  function sectionBodyNodes(section) {
    return [...section.children].filter((child) => !child.classList.contains('tablesnap-editor-section-head'));
  }

  function setSectionExpanded(section, expanded) {
    const title = sectionTitle(section);
    sectionState.set(title, expanded);
    section.dataset.accordionExpanded = String(expanded);
    section.querySelector(':scope > .tablesnap-editor-section-head [data-accordion-trigger]')
      ?.setAttribute('aria-expanded', String(expanded));
    section.querySelector(':scope > .tablesnap-editor-section-head [data-accordion-chevron]')
      ?.setAttribute('aria-label', expanded ? `Collapse ${title}` : `Expand ${title}`);
    sectionBodyNodes(section).forEach((node) => {
      node.hidden = !expanded;
    });
  }

  function syncSections(editor) {
    [...editor.querySelectorAll(SECTION_SELECTOR)].forEach((section) => {
      const title = sectionTitle(section);
      const expanded = sectionState.has(title) ? sectionState.get(title) : DEFAULT_EXPANDED.has(title);
      setSectionExpanded(section, expanded);
    });
  }

  function toggleSection(section) {
    const expanded = section.dataset.accordionExpanded === 'true';
    setSectionExpanded(section, !expanded);
    if (!expanded) section.scrollIntoView({ block: 'nearest' });
  }

  function buildTrigger(section, head) {
    if (head.querySelector('[data-accordion-trigger]')) return;

    const titleNode = head.querySelector('strong');
    const descriptionNode = head.querySelector('span');
    const title = titleNode?.textContent?.trim() || 'Section';
    const descriptionText = descriptionNode?.textContent?.trim() || '';
    head.querySelector('[data-cleanup-reset]')?.remove();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tablesnap-editor-accordion-trigger';
    trigger.dataset.accordionTrigger = 'true';

    const icon = document.createElement('span');
    icon.className = 'tablesnap-editor-section-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = SECTION_ICONS[title] || SECTION_ICONS.Columns;

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-accordion-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const description = document.createElement('span');
    description.textContent = descriptionText;
    copy.append(strong, description);
    trigger.append(icon, copy);

    const actions = document.createElement('span');
    actions.className = 'tablesnap-editor-accordion-actions';

    const chevronButton = document.createElement('button');
    chevronButton.type = 'button';
    chevronButton.className = 'tablesnap-editor-accordion-chevron-button';
    chevronButton.dataset.accordionChevron = 'true';
    chevronButton.setAttribute('aria-label', `Collapse ${title}`);
    chevronButton.innerHTML = '<svg class="tablesnap-editor-accordion-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 8.25 10 11.75l3.5-3.5"/></svg>';
    chevronButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSection(section);
    });
    actions.append(chevronButton);

    head.replaceChildren(trigger, actions);
    trigger.addEventListener('click', () => toggleSection(section));
  }

  function setupSection(section) {
    if (section.dataset.accordionReady === 'true') return;
    const head = section.querySelector(':scope > .tablesnap-editor-section-head');
    if (!head) return;

    section.dataset.accordionReady = 'true';
    section.dataset.accordionTitle = sectionTitle(section);
    head.classList.add('tablesnap-editor-accordion-head');
    buildTrigger(section, head);
  }

  function setupEditor(editor) {
    if (!editor) return;
    activeEditor = editor;
    [...editor.querySelectorAll(SECTION_SELECTOR)].forEach(setupSection);
    syncSections(editor);
  }

  function scan() {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (!editor) {
      activeEditor = null;
      sectionState.clear();
      return;
    }
    setupEditor(editor);
  }

  const tableEditorAccordionObserver = new MutationObserver(() => {
    if (!activeEditor?.isConnected || document.querySelector(EDITOR_SELECTOR)) scan();
  });
  tableEditorAccordionObserver.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
