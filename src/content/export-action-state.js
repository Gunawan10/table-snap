(() => {
  const CARD_SELECTOR = '.tablesnap-export-card[data-tablesnap-modernized="true"], .tablesnap-modern-export-card[data-tablesnap-modernized="true"]';
  const ACTION_SELECTOR = '.tablesnap-tile-action';
  const FALLBACK_UNLOCK_MS = 12000;

  function unlock(card, button, tile) {
    delete card.dataset.exportBusy;
    delete card.dataset.exportBusyType;
    tile?.removeAttribute('data-processing');
    tile?.removeAttribute('data-processing-label');
    button?.removeAttribute('data-action-loading');
    if (card.isConnected) {
      card.querySelectorAll(ACTION_SELECTOR).forEach((action) => { action.disabled = false; });
    }
  }

  function setBusy(card, button) {
    if (!card || !button || card.dataset.exportBusy === 'true') return false;

    const tile = button.closest('.tablesnap-format-tile');
    card.dataset.exportBusy = 'true';
    card.dataset.exportBusyType = 'save';
    tile?.setAttribute('data-processing', 'true');
    tile?.setAttribute('data-processing-label', 'Saving...');
    button.dataset.actionLoading = 'true';

    card.querySelectorAll(ACTION_SELECTOR).forEach((action) => {
      if (action !== button) action.disabled = true;
    });

    const fallbackTimer = setTimeout(() => unlock(card, button, tile), FALLBACK_UNLOCK_MS);
    const done = () => {
      clearTimeout(fallbackTimer);
      unlock(card, button, tile);
    };

    button.addEventListener('tablesnap:save-complete', done, { once: true });
    button.addEventListener('tablesnap:save-failed', done, { once: true });
    return true;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.(ACTION_SELECTOR);
    if (!button) return;

    const card = button.closest(CARD_SELECTOR);
    if (!card) return;

    if (button.matches('[data-tile-copy]')) return;

    if (card.dataset.exportBusy === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    setBusy(card, button);
  }, true);
})();
