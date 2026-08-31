(() => {
  let pendingBackground = null;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  function isTransparent(color) {
    if (!color || color === 'transparent') return true;
    const normalized = color.replace(/\s+/g, '').toLowerCase();
    return normalized === 'rgba(0,0,0,0)' || normalized.endsWith(',0)');
  }

  function resolveBackground(element) {
    let node = element;
    while (node && node instanceof Element) {
      const color = getComputedStyle(node).backgroundColor;
      if (!isTransparent(color)) return color;
      node = node.parentElement;
    }

    const bodyColor = getComputedStyle(document.body).backgroundColor;
    if (!isTransparent(bodyColor)) return bodyColor;

    const htmlColor = getComputedStyle(document.documentElement).backgroundColor;
    if (!isTransparent(htmlColor)) return htmlColor;

    return matchMedia('(prefers-color-scheme: dark)').matches ? '#111111' : '#ffffff';
  }

  function findTableForIcon(icon) {
    if (!icon) return null;
    const rect = icon.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const matches = [...document.querySelectorAll('table')].filter((table) => {
      const tableRect = table.getBoundingClientRect();
      return x >= tableRect.left && x <= tableRect.right && y >= tableRect.top && y <= tableRect.bottom;
    });

    return matches.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    })[0] || null;
  }

  document.addEventListener('pointerdown', (event) => {
    const imageButton = event.target.closest?.('.tablesnap-export-card [data-format="image"]');
    if (!imageButton) return;

    const icons = [...document.querySelectorAll('.tablesnap-export-icon')];
    const icon = icons.find((item) => item.dataset.cardOpen === 'true')
      || icons.find((item) => item.classList.contains('visible'))
      || null;
    const table = findTableForIcon(icon);
    pendingBackground = table ? resolveBackground(table) : resolveBackground(document.body);
  }, true);

  HTMLCanvasElement.prototype.toBlob = function patchedToBlob(callback, type, quality) {
    if (!pendingBackground || type !== 'image/png') {
      return originalToBlob.call(this, callback, type, quality);
    }

    const background = pendingBackground;
    pendingBackground = null;

    const flattened = document.createElement('canvas');
    flattened.width = this.width;
    flattened.height = this.height;
    const context = flattened.getContext('2d');
    context.fillStyle = background;
    context.fillRect(0, 0, flattened.width, flattened.height);
    context.drawImage(this, 0, 0);

    return originalToBlob.call(flattened, callback, type, quality);
  };
})();
