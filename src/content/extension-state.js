const TABLESNAP_DEFAULT_ENABLED = true;

async function applyTableSnapEnabledState() {
  const { enabled = TABLESNAP_DEFAULT_ENABLED } = await chrome.storage.local.get({ enabled: TABLESNAP_DEFAULT_ENABLED });
  document.documentElement.dataset.tablesnapEnabled = String(Boolean(enabled));
}

applyTableSnapEnabledState();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.enabled) return;
  document.documentElement.dataset.tablesnapEnabled = String(Boolean(changes.enabled.newValue));
});
