const DEFAULTS = {
  enabled: true,
  iconVisibility: 'hover',
  iconPosition: 'top-right',
  iconSize: 'small',
  defaultFormat: 'csv',
  csvDelimiter: ',',
  imageScale: 2,
  theme: 'system'
};

const form = document.querySelector('#settings-form');
const resetButton = document.querySelector('#reset');
const enabledToggle = document.querySelector('#enabled');

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

async function load() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  enabledToggle.checked = Boolean(settings.enabled);
  Object.entries(settings).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = String(value);
  });
  applyTheme(settings.theme);
}

enabledToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabledToggle.checked });
});

form.addEventListener('change', async (event) => {
  const field = event.target;
  if (!field.name) return;
  const value = field.name === 'imageScale' ? Number(field.value) : field.value;
  await chrome.storage.local.set({ [field.name]: value });
  if (field.name === 'theme') applyTheme(value);
});

resetButton.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  await chrome.storage.local.set(DEFAULTS);
  await load();
});

load();
