(() => {
  let pendingBackground = null;
  let pendingLayoutRestore = null;
  let restoreTimer = null;
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

  function isHorizontalClipper(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.scrollWidth <= node.clientWidth + 1) return false;
    const style = getComputedStyle(node);
    return /auto|scroll|hidden|clip/.test(style.overflowX)
      || /auto|scroll|hidden|clip/.test(style.overflow);
  }

  function findScrollRegion(table) {
    let node = table?.parentElement || null;

    for (let depth = 0; node && depth < 8 && node !== document.body; depth += 1, node = node.parentElement) {
      const nested = [...node.querySelectorAll('*')].filter(isHorizontalClipper);
      if (isHorizontalClipper(node) || nested.length) return node;
    }

    return table?.parentElement || null;
  }

  function restoreExpandedLayout() {
    clearTimeout(restoreTimer);
    restoreTimer = null;
    pendingLayoutRestore?.();
    pendingLayoutRestore = null;
  }

  function expandHorizontalScrollContainers(table) {
    restoreExpandedLayout();
    if (!table) return;

    const region = findScrollRegion(table);
    if (!region) return;

    const clippers = [region, ...region.querySelectorAll('*')].filter(isHorizontalClipper);
    const tables = [table, ...region.querySelectorAll('table')];
    const fullWidth = Math.ceil(Math.max(
      region.scrollWidth,
      region.getBoundingClientRect().width,
      ...clippers.map((node) => node.scrollWidth),
      ...tables.map((node) => Math.max(node.scrollWidth, node.getBoundingClientRect().width))
    ));

    if (!Number.isFinite(fullWidth) || fullWidth <= 0) return;

    const changed = [];
    const changedNodes = new Set();

    function expandNode(node, width, resetScroll = false) {
      if (!(node instanceof HTMLElement) || changedNodes.has(node)) return;
      changedNodes.add(node);
      changed.push({
        node,
        width: node.style.width,
        minWidth: node.style.minWidth,
        maxWidth: node.style.maxWidth,
        overflow: node.style.overflow,
        overflowX: node.style.overflowX,
        scrollLeft: node.scrollLeft
      });

      if (resetScroll) node.scrollLeft = 0;
      node.style.setProperty('width', `${width}px`, 'important');
      node.style.setProperty('min-width', `${width}px`, 'important');
      node.style.setProperty('max-width', 'none', 'important');
      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('overflow-x', 'visible', 'important');
    }

    clippers.forEach((node) => expandNode(node, Math.max(fullWidth, node.scrollWidth), true));
    tables.forEach((node) => {
      if (node.scrollWidth > node.clientWidth + 1 || node.getBoundingClientRect().width < fullWidth) {
        expandNode(node, Math.max(fullWidth, node.scrollWidth));
      }
    });

    let ancestor = region;
    for (let depth = 0; ancestor && depth < 5 && ancestor !== document.body; depth += 1, ancestor = ancestor.parentElement) {
      expandNode(ancestor, fullWidth);
    }

    if (!changed.length) return;

    pendingLayoutRestore = () => {
      changed.reverse().forEach((state) => {
        state.node.style.width = state.width;
        state.node.style.minWidth = state.minWidth;
        state.node.style.maxWidth = state.maxWidth;
        state.node.style.overflow = state.overflow;
        state.node.style.overflowX = state.overflowX;
        state.node.scrollLeft = state.scrollLeft;
      });
    };

    restoreTimer = setTimeout(restoreExpandedLayout, 10000);
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
    expandHorizontalScrollContainers(table);
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

    restoreExpandedLayout();
    return originalToBlob.call(flattened, callback, type, quality);
  };
})();
