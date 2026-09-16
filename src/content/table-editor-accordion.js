(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SECTION_SELECTOR = '.tablesnap-editor-sidebar > .tablesnap-editor-section';
  const DEFAULT_EXPANDED = new Set(['Columns', 'Data Cleanup', 'Content', 'File Settings']);

  let activeEditor = null;
  let expandedSections = new Set(DEFAULT_EXPANDED);

  function sectionTitle(section) {
    return section.querySelector('.tablesnap-editor-section-head strong')?.textContent?.trim() || '';
  }

  function sectionBodyNodes(section) {
    return [...section.children].filter((child) => !child.classList.contains('tablesnap-editor-section-head'));
  }

  function setSectionExpanded(section, expanded) {
    const title = sectionTitle(section);
    section.dataset.accordionExpanded = String(expanded);
    const trigger = section.querySelector(':scope > .tablesnap-editor-section-head [data-accordion-trigger]');
    trigger?.setAttribute('aria-expanded', String(expanded));
    trigger?.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${title}`);
    sectionBodyNodes(section).forEach((node) => {
      node.hidden = !expanded;
    });
  }

  function syncSections(editor) {
    const sections = [...editor.querySelectorAll(SECTION_SELECTOR)];
    sections.forEach((section) => {
      setSectionExpanded(section, expandedSections.has(sectionTitle(section)));
    });
  }

  function toggleSection(editor, title) {
    if (expandedSections.has(title)) expandedSections.delete(title);
    else expandedSections.add(title);
    syncSections(editor);
  }

  function buildTrigger(section, head) {
    if (head.querySelector('[data-accordion-trigger]')) return;

    const titleNode = head.querySelector('strong');
    const descriptionNode = head.querySelector('span');
    const title = titleNode?.textContent?.trim() || 'Section';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'tablesnap-editor-accordion-trigger';
    trigger.dataset.accordionTrigger = 'true';
    trigger.setAttribute('aria-expanded', String(expandedSections.has(title)));
    trigger.setAttribute('aria-label', `${expandedSections.has(title) ? 'Collapse' : 'Expand'} ${title}`);

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-accordion-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const description = document.createElement('span');
    description.textContent = descriptionNode?.textContent?.trim() || '';
    copy.append(strong, description);

    const chevron = document.createElement('span');
    chevron.className = 'tablesnap-editor-accordion-chevron-wrap';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg class="tablesnap-editor-accordion-chevron" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>';
    trigger.append(copy, chevron);

    const reset = head.querySelector('[data-cleanup-reset]');
    head.replaceChildren(trigger);
    if (reset) head.append(reset);

    trigger.addEventListener('click', () => {
      const editor = section.closest(EDITOR_SELECTOR);
      if (!editor) return;
      toggleSection(editor, title);
    });
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
      expandedSections = new Set(DEFAULT_EXPANDED);
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
