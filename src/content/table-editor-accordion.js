(() => {
  const EDITOR_SELECTOR = '.tablesnap-table-editor';
  const SECTION_SELECTOR = '.tablesnap-editor-sidebar > .tablesnap-editor-section';
  const DEFAULT_SECTION = 'Columns';

  let activeEditor = null;
  let activeSection = DEFAULT_SECTION;

  function sectionTitle(section) {
    return section.querySelector('.tablesnap-editor-section-head strong')?.textContent?.trim() || '';
  }

  function sectionBodyNodes(section) {
    return [...section.children].filter((child) => !child.classList.contains('tablesnap-editor-section-head'));
  }

  function setSectionExpanded(section, expanded) {
    section.dataset.accordionExpanded = String(expanded);
    const trigger = section.querySelector(':scope > .tablesnap-editor-section-head [data-accordion-trigger]');
    trigger?.setAttribute('aria-expanded', String(expanded));
    sectionBodyNodes(section).forEach((node) => {
      node.hidden = !expanded;
    });
  }

  function syncSections(editor) {
    const sections = [...editor.querySelectorAll(SECTION_SELECTOR)];
    if (!sections.length) return;

    const titles = new Set(sections.map(sectionTitle));
    if (!titles.has(activeSection)) activeSection = DEFAULT_SECTION;

    sections.forEach((section) => {
      const title = sectionTitle(section);
      setSectionExpanded(section, title === activeSection);
    });
  }

  function activateSection(editor, title) {
    activeSection = title;
    syncSections(editor);
    const section = [...editor.querySelectorAll(SECTION_SELECTOR)].find((item) => sectionTitle(item) === title);
    section?.scrollIntoView({ block: 'nearest' });
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
    trigger.setAttribute('aria-expanded', String(title === activeSection));

    const copy = document.createElement('span');
    copy.className = 'tablesnap-editor-accordion-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const description = document.createElement('span');
    description.textContent = descriptionNode?.textContent?.trim() || '';
    copy.append(strong, description);

    const chevron = document.createElement('svg');
    chevron.className = 'tablesnap-editor-accordion-chevron';
    chevron.setAttribute('viewBox', '0 0 20 20');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<path d="m6 8 4 4 4-4"/>';
    trigger.append(copy, chevron);

    const reset = head.querySelector('[data-cleanup-reset]');
    head.replaceChildren(trigger);
    if (reset) head.append(reset);

    trigger.addEventListener('click', () => {
      const editor = section.closest(EDITOR_SELECTOR);
      if (!editor) return;
      if (activeSection === title) {
        activeSection = '';
        syncSections(editor);
      } else {
        activateSection(editor, title);
      }
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
      activeSection = DEFAULT_SECTION;
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
