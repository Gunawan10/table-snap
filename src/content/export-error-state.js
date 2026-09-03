(() => {
  const FAILED_STATE_MS = 1400;

  function failedSvg() {
    return '<svg class="tablesnap-failed" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  }

  function ensureStyles() {
    if (document.getElementById('tablesnap-export-error-styles')) return;

    const style = document.createElement('style');
    style.id = 'tablesnap-export-error-styles';
    style.textContent = `
      .tablesnap-card-actions button[data-save-state="failed"] {
        border-color: #ef4444 !important;
        background: rgba(239, 68, 68, .06) !important;
      }
      .tablesnap-card-actions button[data-save-state="failed"] strong,
      .tablesnap-card-actions button[data-save-state="failed"] .tablesnap-failed {
        color: #ef4444 !important;
      }
      .tablesnap-failed {
        width: 17px !important;
        height: 17px !important;
        fill: none !important;
        stroke: currentColor !important;
        stroke-width: 1.9 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
      }
    `;
    document.documentElement.append(style);
  }

  function showFailed(button) {
    if (!(button instanceof HTMLButtonElement) || !button.isConnected) return;
    if (button.dataset.failureTimer) clearTimeout(Number(button.dataset.failureTimer));

    const title = button.querySelector('strong');
    const icon = button.querySelector('.tablesnap-download-icon');
    if (!title || !icon) return;

    button.dataset.saveState = 'failed';
    title.textContent = 'Failed';
    icon.innerHTML = failedSvg();

    const timer = setTimeout(() => {
      delete button.dataset.failureTimer;
      if (!button.isConnected || button.dataset.saveState !== 'failed') return;

      button.dataset.saveState = 'idle';
      title.textContent = button.dataset.originalTitle || title.textContent;
      icon.innerHTML = '';
    }, FAILED_STATE_MS);

    button.dataset.failureTimer = String(timer);
  }

  ensureStyles();

  const previousStates = new WeakMap();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const button = mutation.target;
      if (!(button instanceof HTMLButtonElement)) return;
      if (!button.matches('.tablesnap-export-card [data-format]')) return;

      const current = button.dataset.saveState || 'idle';
      const previous = previousStates.get(button);
      previousStates.set(button, current);

      if (previous === 'loading' && current === 'idle') showFailed(button);
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-save-state']
  });

  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('.tablesnap-export-card [data-format]');
    if (!(button instanceof HTMLButtonElement)) return;
    previousStates.set(button, button.dataset.saveState || 'idle');
  }, true);
})();
