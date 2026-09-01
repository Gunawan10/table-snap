const TABLESNAP_DEFAULT_ENABLED = true;
const TABLESNAP_DEFAULT_ACCENT = 'orange';

async function applyTableSnapState() {
  const { enabled = TABLESNAP_DEFAULT_ENABLED, accentColor = TABLESNAP_DEFAULT_ACCENT } = await chrome.storage.local.get({
    enabled: TABLESNAP_DEFAULT_ENABLED,
    accentColor: TABLESNAP_DEFAULT_ACCENT
  });
  document.documentElement.dataset.tablesnapEnabled = String(Boolean(enabled));
  document.documentElement.dataset.tablesnapAccent = accentColor;
}

applyTableSnapState();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) document.documentElement.dataset.tablesnapEnabled = String(Boolean(changes.enabled.newValue));
  if (changes.accentColor) document.documentElement.dataset.tablesnapAccent = changes.accentColor.newValue || TABLESNAP_DEFAULT_ACCENT;
});
