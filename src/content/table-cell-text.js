export function cleanCellText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const REMOVED_SELECTOR = [
  'script',
  'style',
  'noscript',
  'canvas',
  'input',
  'select',
  'textarea',
  '[aria-hidden="true"]',
  '[hidden]',
  '.tablesnap-export-icon',
  '.tablesnap-export-card',
  '.tablesnap-modern-export-card'
].join(',');

const VISUAL_SELECTOR = 'svg, img, button, [role="button"]';

function semanticLabel(element) {
  if (!(element instanceof Element)) return '';
  return cleanCellText(
    element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('alt')
      || ''
  );
}

function hasMeaningfulVisibleText(element) {
  return cleanCellText(element.textContent || '') !== '';
}

function replaceMeaningfulVisuals(clone) {
  clone.querySelectorAll(VISUAL_SELECTOR).forEach((element) => {
    const visibleText = hasMeaningfulVisibleText(element)
      ? cleanCellText(element.textContent || '')
      : '';
    const fallback = semanticLabel(element);
    const value = visibleText || fallback;

    if (value) {
      element.replaceWith(clone.ownerDocument.createTextNode(` ${value} `));
    } else {
      element.remove();
    }
  });
}

export function extractCellText(cell) {
  if (!(cell instanceof Element)) return cleanCellText(cell);

  const clone = cell.cloneNode(true);
  clone.querySelectorAll(REMOVED_SELECTOR).forEach((node) => node.remove());
  replaceMeaningfulVisuals(clone);
  return cleanCellText(clone.textContent || '');
}
