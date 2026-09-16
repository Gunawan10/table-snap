const TABLESNAP_DEFAULT_ENABLED = true;
const TABLESNAP_DEFAULT_ACCENT = 'orange';
const TABLESNAP_DEFAULT_THEME = 'system';

async function applyTableSnapState() {
  const {
    enabled = TABLESNAP_DEFAULT_ENABLED,
    accentColor = TABLESNAP_DEFAULT_ACCENT,
    theme = TABLESNAP_DEFAULT_THEME
  } = await chrome.storage.local.get({
    enabled: TABLESNAP_DEFAULT_ENABLED,
    accentColor: TABLESNAP_DEFAULT_ACCENT,
    theme: TABLESNAP_DEFAULT_THEME
  });
  document.documentElement.dataset.tablesnapEnabled = String(Boolean(enabled));
  document.documentElement.dataset.tablesnapAccent = accentColor;
  document.documentElement.dataset.tablesnapTheme = theme;
}

applyTableSnapState();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) document.documentElement.dataset.tablesnapEnabled = String(Boolean(changes.enabled.newValue));
  if (changes.accentColor) document.documentElement.dataset.tablesnapAccent = changes.accentColor.newValue || TABLESNAP_DEFAULT_ACCENT;
  if (changes.theme) document.documentElement.dataset.tablesnapTheme = changes.theme.newValue || TABLESNAP_DEFAULT_THEME;
});
