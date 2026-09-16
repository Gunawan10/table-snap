(() => {
  const BACKDROP_SELECTOR = '.tablesnap-table-editor .tablesnap-editor-backdrop';

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.(BACKDROP_SELECTOR)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
