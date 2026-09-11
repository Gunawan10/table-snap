const DEFAULTS = {
  enabled: true,
  iconVisibility: 'hover',
  iconPosition: 'top-right',
  iconSize: 'small',
  defaultFormat: 'csv',
  csvDelimiter: ',',
  imageScale: 2,
  pdfOrientation: 'auto',
  pdfPageSize: 'a4',
  xlsxIncludeHeader: true,
  xlsxAutoColumnWidth: true,
  xlsxWrapText: true,
  xlsxAutoFilter: true,
  theme: 'system',
  accentColor: 'orange'
};

const form = document.querySelector('#settings-form');
const resetButton = document.querySelector('#reset');
const enabledToggle = document.querySelector('#enabled');
const navItems = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('[data-panel]')];
const formatTabs = [...document.querySelectorAll('[data-format-tab]')];
const formatPanels = [...document.querySelectorAll('[data-format-panel]')];
const previewTable = document.querySelector('.fake-table');

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function applyAccent(accentColor) {
  document.body.dataset.accent = accentColor;
}

function applyPreviewSettings(settings) {
  if (!previewTable) return;
  previewTable.dataset.iconVisibility = settings.iconVisibility || DEFAULTS.iconVisibility;
  previewTable.dataset.iconPosition = settings.iconPosition || DEFAULTS.iconPosition;
  previewTable.dataset.iconSize = settings.iconSize || DEFAULTS.iconSize;
}

function applyEnabledState(enabled) {
  document.body.dataset.extensionEnabled = String(Boolean(enabled));
  form.querySelectorAll('select, input, button').forEach((control) => {
    control.disabled = !enabled;
  });
}

function showTab(name) {
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.tab === name));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === name));
}

function showFormatTab(name) {
  formatTabs.forEach((item) => item.classList.toggle('is-active', item.dataset.formatTab === name));
  formatPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.formatPanel === name));
}

async function load() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  enabledToggle.checked = Boolean(settings.enabled);

  Object.entries(settings).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field) return;
    if (field instanceof RadioNodeList) {
      field.value = String(value);
      return;
    }
    if (field.type === 'checkbox') {
      field.checked = Boolean(value);
      return;
    }
    field.value = String(value);
  });

  applyTheme(settings.theme);
  applyAccent(settings.accentColor);
  applyPreviewSettings(settings);
  applyEnabledState(settings.enabled);
}

enabledToggle.addEventListener('change', async () => {
  const enabled = enabledToggle.checked;
  applyEnabledState(enabled);
  await chrome.storage.local.set({ enabled });
});

navItems.forEach((item) => {
  item.addEventListener('click', () => showTab(item.dataset.tab));
});

formatTabs.forEach((item) => {
  item.addEventListener('click', () => showFormatTab(item.dataset.formatTab));
});

form.addEventListener('change', async (event) => {
  const field = event.target;
  if (!field.name) return;

  let value;
  if (field.type === 'checkbox') value = field.checked;
  else if (field.name === 'imageScale') value = Number(field.value);
  else value = field.value;

  await chrome.storage.local.set({ [field.name]: value });
  if (field.name === 'theme') applyTheme(value);
  if (field.name === 'accentColor') applyAccent(value);
  if (['iconVisibility', 'iconPosition', 'iconSize'].includes(field.name)) {
    const previewSettings = {
      iconVisibility: form.elements.namedItem('iconVisibility')?.value,
      iconPosition: form.elements.namedItem('iconPosition')?.value,
      iconSize: form.elements.namedItem('iconSize')?.value
    };
    applyPreviewSettings(previewSettings);
  }
});

resetButton.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  await chrome.storage.local.set(DEFAULTS);
  await load();
});

showTab('general');
showFormatTab('csv');
load();
