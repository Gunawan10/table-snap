(() => {
  const CARD_SELECTOR = '.tablesnap-export-card[data-tablesnap-modernized="true"], .tablesnap-modern-export-card[data-tablesnap-modernized="true"]';
  const ACTION_SELECTOR = '.tablesnap-tile-action';
  const RESULT_LABELS = new Set(['Saved', 'Copied', 'Failed']);
  const FALLBACK_UNLOCK_MS = 12000;

  function setBusy(card, button, type) {
    if (!card || !button || card.dataset.exportBusy === 'true') return false;

    const tile = button.closest('.tablesnap-format-tile');
    card.dataset.exportBusy = 'true';
    card.dataset.exportBusyType = type;
    tile?.setAttribute('data-processing', 'true');
    button.dataset.actionLoading = 'true';
    button.dataset.loadingText = type === 'copy' ? 'Copying...' : 'Saving...';

    card.querySelectorAll(ACTION_SELECTOR).forEach((action) => {
      if (action !== button) action.disabled = true;
    });

    const label = button.querySelector('.tablesnap-tile-action-label');
    let completed = false;
    let observer = null;
    let fallbackTimer = null;

    const unlock = () => {
      if (completed) return;
      completed = true;
      observer?.disconnect();
      clearTimeout(fallbackTimer);
      delete card.dataset.exportBusy;
      delete card.dataset.exportBusyType;
      tile?.removeAttribute('data-processing');
      delete button.dataset.actionLoading;
      delete button.dataset.loadingText;
      if (card.isConnected) {
        card.querySelectorAll(ACTION_SELECTOR).forEach((action) => { action.disabled = false; });
      }
    };

    if (label) {
      observer = new MutationObserver(() => {
        if (RESULT_LABELS.has(label.textContent?.trim())) {
          setTimeout(unlock, 700);
        }
      });
      observer.observe(label, { childList: true, characterData: true, subtree: true });
    }

    const cardObserver = new MutationObserver(() => {
      if (!card.isConnected) {
        cardObserver.disconnect();
        unlock();
      }
    });
    cardObserver.observe(document.documentElement, { childList: true, subtree: true });

    fallbackTimer = setTimeout(() => {
      cardObserver.disconnect();
      unlock();
    }, FALLBACK_UNLOCK_MS);

    return true;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.(ACTION_SELECTOR);
    if (!button) return;

    const card = button.closest(CARD_SELECTOR);
    if (!card) return;

    if (card.dataset.exportBusy === 'true') {
      if (button.dataset.actionLoading !== 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    const type = button.matches('[data-tile-copy]') ? 'copy' : 'save';
    setBusy(card, button, type);
  }, true);
})();
