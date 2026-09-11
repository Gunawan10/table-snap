function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function cleanStructuredText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isDecorative(element) {
  if (!(element instanceof Element)) return false;
  if (element.getAttribute('aria-hidden') === 'true') return true;
  if (element.getAttribute('role') === 'presentation') return true;
  if (element.getAttribute('role') === 'none') return true;
  return false;
}

function meaningfulLabel(element) {
  if (!(element instanceof Element) || isDecorative(element)) return '';
  return cleanText(
    element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('alt')
      || ''
  );
}

function preserveStructure(clone) {
  clone.querySelectorAll('br').forEach((node) => node.replaceWith(document.createTextNode('\n')));

  clone.querySelectorAll('li').forEach((item) => {
    const parent = item.parentElement;
    const ordered = parent?.tagName === 'OL';
    const index = ordered ? [...parent.children].filter((child) => child.tagName === 'LI').indexOf(item) + 1 : 0;
    const prefix = ordered ? `${index}. ` : '• ';
    item.insertBefore(document.createTextNode(prefix), item.firstChild);
    item.append(document.createTextNode('\n'));
  });

  clone.querySelectorAll('p, div').forEach((block) => {
    if (!block.nextSibling) return;
    block.append(document.createTextNode('\n'));
  });
}

function visibleMeaningfulText(cell) {
  if (!(cell instanceof Element)) return '';
  const clone = cell.cloneNode(true);

  clone.querySelectorAll([
    'script', 'style', 'noscript', 'svg', 'canvas', 'img',
    'input', 'select', 'textarea',
    '[aria-hidden="true"]', '[hidden]',
    '.tablesnap-export-icon', '.tablesnap-export-card', '.tablesnap-modern-export-card'
  ].join(',')).forEach((node) => node.remove());

  clone.querySelectorAll('button, [role="button"]').forEach((button) => {
    const text = cleanText(button.textContent || '');
    if (text) {
      button.replaceWith(document.createTextNode(text));
      return;
    }

    const label = meaningfulLabel(button);
    if (label) button.replaceWith(document.createTextNode(label));
    else button.remove();
  });

  preserveStructure(clone);
  return cleanStructuredText(clone.textContent || '');
}

function semanticFallback(cell) {
  if (!(cell instanceof Element)) return '';

  const ownLabel = meaningfulLabel(cell);
  if (ownLabel) return ownLabel;

  const candidates = [...cell.querySelectorAll('[aria-label], [title], img[alt]')];
  for (const candidate of candidates) {
    const label = meaningfulLabel(candidate);
    if (label) return label;
  }

  return '';
}

function extractSemanticCellText(cell) {
  const visible = visibleMeaningfulText(cell);
  if (visible) return visible;
  return semanticFallback(cell);
}

function nativeRows(table) {
  if (!(table instanceof HTMLTableElement)) return [];
  return [...table.rows].filter((row) => {
    if (row.hidden || row.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(row);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  });
}

function modernRows(root) {
  if (!(root instanceof Element)) return [];
  const roleRows = [...root.querySelectorAll('[role="row"]')].filter((row) => {
    const owner = row.parentElement?.closest('[role="table"], [role="grid"], [role="treegrid"]');
    return owner === root;
  });
  if (roleRows.length) return roleRows;

  const directRows = [...root.children].filter((row) => /(^|[\s_-])(row|table-row|grid-row)([\s_-]|$)/i.test(`${row.id || ''} ${row.className || ''}`));
  if (directRows.length) return directRows;

  const style = getComputedStyle(root);
  if (['grid', 'inline-grid'].includes(style.display)) {
    const tracks = style.gridTemplateColumns?.split(/\s+/).filter(Boolean).length || 0;
    if (tracks > 1) {
      const cells = [...root.children];
      const rows = [];
      for (let i = 0; i < cells.length; i += tracks) rows.push(cells.slice(i, i + tracks));
      return rows;
    }
  }

  return [];
}

function rowCells(row) {
  if (Array.isArray(row)) return row;
  if (row instanceof HTMLTableRowElement) return [...row.cells];
  if (!(row instanceof Element)) return [];

  const roleCells = [...row.querySelectorAll(':scope > [role="columnheader"], :scope > [role="rowheader"], :scope > [role="cell"], :scope > [role="gridcell"]')];
  if (roleCells.length) return roleCells;
  return [...row.children].filter((child) => /(^|[\s_-])(cell|column|col|table-cell|grid-cell)([\s_-]|$)/i.test(`${child.id || ''} ${child.className || ''}`));
}

function semanticMatrix(source, type) {
  const rows = type === 'native' ? nativeRows(source) : modernRows(source);
  return rows.map((row) => rowCells(row).map(extractSemanticCellText));
}

function shouldPreferStructuredValue(current, semantic) {
  const structured = cleanStructuredText(semantic);
  if (!structured.includes('\n')) return false;
  return cleanText(current) === cleanText(structured);
}

function applyFallback(parsed, source, type) {
  if (!parsed?.headers?.length || !source) return parsed;

  const matrix = semanticMatrix(source, type);
  if (!matrix.length) return parsed;

  const normalized = {
    headers: [...parsed.headers],
    rows: parsed.rows.map((row) => [...row])
  };

  const headerIndex = matrix.findIndex((row) => {
    if (row.length !== normalized.headers.length) return false;
    return row.some((value, index) => cleanText(value) === cleanText(normalized.headers[index]));
  });

  const dataStart = headerIndex >= 0 ? headerIndex + 1 : Math.max(0, matrix.length - normalized.rows.length);

  normalized.rows.forEach((row, rowIndex) => {
    const semanticRow = matrix[dataStart + rowIndex] || [];
    row.forEach((value, columnIndex) => {
      const semantic = cleanStructuredText(semanticRow[columnIndex] || '');
      if (!semantic) return;

      if (!cleanText(value) || shouldPreferStructuredValue(value, semantic)) {
        row[columnIndex] = semantic;
      }
    });
  });

  return normalized;
}

function patchParser(target, key, type) {
  const original = target?.[key];
  if (typeof original !== 'function' || original.__tablesnapSemanticPatched) return;

  const patched = function patchedParser(source, ...args) {
    const parsed = original.call(this, source, ...args);
    return applyFallback(parsed, source, type);
  };
  patched.__tablesnapSemanticPatched = true;
  target[key] = patched;
}

patchParser(window.__TableSnapCore, 'parseTable', 'native');
patchParser(window.__TableSnapModern, 'parseModernTable', 'modern');

window.__TableSnapSemantic = {
  extractSemanticCellText,
  applyFallback
};
