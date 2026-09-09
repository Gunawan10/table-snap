import html2canvas from 'html2canvas';

let activeModernRoot = null;

function isTransparent(color) {
  const value = String(color || '').trim().toLowerCase();
  return !value
    || value === 'transparent'
    || value === 'rgba(0, 0, 0, 0)'
    || value === 'rgba(0,0,0,0)';
}

function resolveBackground(element) {
  let node = element;
  while (node instanceof Element) {
    const color = getComputedStyle(node).backgroundColor;
    if (!isTransparent(color)) return color;
    node = node.parentElement;
  }

  const bodyColor = document.body ? getComputedStyle(document.body).backgroundColor : '';
  if (!isTransparent(bodyColor)) return bodyColor;

  const htmlColor = getComputedStyle(document.documentElement).backgroundColor;
  if (!isTransparent(htmlColor)) return htmlColor;

  return '#ffffff';
}

function findModernRootForIcon(icon) {
  const modern = window.__TableSnapModern;
  if (!modern?.getModernType) return null;

  const rect = icon.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const candidates = [...document.querySelectorAll('[role="table"], [role="grid"], [role="treegrid"], div, section')]
    .filter((element) => {
      if (element.closest('table') || !modern.getModernType(element)) return false;
      const candidateRect = element.getBoundingClientRect();
      return x >= candidateRect.left - 20
        && x <= candidateRect.right + 20
        && y >= candidateRect.top - 20
        && y <= candidateRect.bottom + 20;
    });

  return candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.width * ar.height - br.width * br.height;
  })[0] || null;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'table';
}

function labelFor(root) {
  const aria = root?.getAttribute?.('aria-label')?.trim();
  if (aria) return aria;
  return document.title || 'table';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.documentElement.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveModernPng(root, button) {
  const { imageScale = 2 } = await chrome.storage.local.get({ imageScale: 2 });
  const backgroundColor = resolveBackground(root);

  button.disabled = true;
  const title = button.querySelector('strong');
  const original = title?.textContent || 'Save as Image';
  if (title) title.textContent = 'Rendering image...';

  try {
    const canvas = await html2canvas(root, {
      backgroundColor,
      scale: imageScale,
      useCORS: true,
      logging: false,
      windowWidth: Math.max(document.documentElement.scrollWidth, root.scrollWidth),
      onclone: (doc) => {
        doc.querySelectorAll('.tablesnap-export-icon, .tablesnap-modern-export-card').forEach((node) => node.remove());
      }
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Failed to create PNG')), 'image/png');
    });

    downloadBlob(
      blob,
      `table-${slugify(labelFor(root))}-${new Date().toISOString().slice(0, 10)}.png`
    );

    if (title) title.textContent = 'Saved';
    setTimeout(() => document.querySelector('.tablesnap-modern-export-card')?.remove(), 650);
  } catch (error) {
    button.disabled = false;
    if (title) title.textContent = original;
    console.error('[TableSnap] Modern PNG export failed:', error);
  }
}

document.addEventListener('click', (event) => {
  const icon = event.target.closest?.('.tablesnap-export-icon[data-tablesnap-modern="true"]');
  if (icon) {
    activeModernRoot = findModernRootForIcon(icon);
    return;
  }

  const button = event.target.closest?.('[data-modern-format="image"]');
  if (!button || !activeModernRoot) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  saveModernPng(activeModernRoot, button);
}, true);
