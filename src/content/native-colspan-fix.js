function isHiddenElement(element) {
  if (!(element instanceof Element)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  const style = getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
}

function isVisibleCell(cell) {
  if (isHiddenElement(cell)) return false;
  const rect = cell.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function visibleCells(row) {
  return [...row.cells].filter(isVisibleCell);
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function rowHasContent(row) {
  return visibleCells(row).some((cell) => cleanText(cell.innerText || cell.textContent || '') !== '');
}

function getDataRows(table) {
  if (!(table instanceof HTMLTableElement)) return [];
  const sections = [...table.tBodies];
  if (table.tFoot) sections.push(table.tFoot);

  const rows = [];
  sections.forEach((section) => {
    [...section.rows].forEach((row) => {
      if (isHiddenElement(row) || !visibleCells(row).length || !rowHasContent(row)) return;
      rows.push(row);
    });
  });
  return rows;
}

function buildSpanCoverage(rows) {
  const grid = [];

  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let columnIndex = 0;

    visibleCells(row).forEach((cell) => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex += 1;

      const rowspan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') || '1', 10));
      const colspan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10));

      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        grid[r] ||= [];
        for (let c = columnIndex; c < columnIndex + colspan; c += 1) {
          grid[r][c] = {
            originColumn: columnIndex,
            colspanContinuation: c > columnIndex
          };
        }
      }

      columnIndex += colspan;
    });
  });

  return grid;
}

function clearDuplicatedColspanValues(parsed, source) {
  if (!parsed?.headers?.length || !Array.isArray(parsed.rows)) return parsed;

  const core = window.__TableSnapCore;
  const dataTable = core?.resolveDataTable?.(source) || source;
  const dataRows = getDataRows(dataTable);
  if (!dataRows.length || dataRows.length !== parsed.rows.length) return parsed;

  const coverage = buildSpanCoverage(dataRows);
  const coverageWidth = coverage.reduce((max, row) => Math.max(max, row.length), 0);

  // Decorative-column compaction can change column indexes. In that case leave the
  // parsed result untouched rather than risking a false correction.
  if (coverageWidth !== parsed.headers.length) return parsed;

  const rows = parsed.rows.map((row, rowIndex) => {
    const next = [...row];
    const coverageRow = coverage[rowIndex] || [];

    coverageRow.forEach((slot, columnIndex) => {
      if (!slot?.colspanContinuation) return;
      next[columnIndex] = '';
    });

    return next;
  });

  return { ...parsed, rows };
}

function patchNativeParser() {
  const core = window.__TableSnapCore;
  const original = core?.parseTable;
  if (typeof original !== 'function' || original.__tablesnapColspanPatched) return;

  const patched = function patchedParseTable(source, ...args) {
    const parsed = original.call(this, source, ...args);
    return clearDuplicatedColspanValues(parsed, source);
  };

  patched.__tablesnapColspanPatched = true;
  core.parseTable = patched;
}

patchNativeParser();

window.__TableSnapNativeColspanFix = {
  clearDuplicatedColspanValues
};
