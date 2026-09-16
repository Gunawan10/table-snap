(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SECTION_SELECTOR = '.tablesnap-editor-sidebar > .tablesnap-editor-section';
  const DEFAULT_EXPANDED = new Set(['Columns', 'Data Cleanup', 'Content', 'File Settings']);

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
    const reset = head.querySelector('[data-cleanup-reset]');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tablesnap-editor-accordion-trigger';
    trigger.dataset.accordionTrigger = 'true';

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-accordion-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const description = document.createElement('span');
    description.textContent = descriptionText;
    copy.append(strong, description);
    trigger.append(copy);

    const actions = document.createElement('span');
    actions.className = 'tablesnap-editor-accordion-actions';

    if (reset) {
      reset.addEventListener('click', (event) => event.stopPropagation());
      actions.append(reset);
    }

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
