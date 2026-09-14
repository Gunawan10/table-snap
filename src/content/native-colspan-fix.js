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

function extractCellText(cell) {
  const semantic = window.__TableSnapSemantic?.extractSemanticCellText?.(cell);
  if (semantic) return cleanText(semantic);
  return cleanText(cell?.innerText || cell?.textContent || '');
}

function rowHasContent(row) {
  return visibleCells(row).some((cell) => extractCellText(cell) !== '');
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
      const text = extractCellText(cell);

      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        grid[r] ||= [];
        for (let c = columnIndex; c < columnIndex + colspan; c += 1) {
          grid[r][c] = {
            originColumn: columnIndex,
            originRow: rowIndex,
            text,
            colspanContinuation: c > columnIndex
          };
        }
      }

      columnIndex += colspan;
    });
  });

  return grid;
}

function normalizedComparable(value) {
  return cleanText(value).toLowerCase();
}

function coverageRowScore(parsedRow, coverageRow) {
  let matches = 0;
  let compared = 0;

  coverageRow.forEach((slot, columnIndex) => {
    if (!slot || slot.colspanContinuation || slot.originRow === undefined) return;
    const expected = normalizedComparable(slot.text);
    if (!expected) return;

    const actual = normalizedComparable(parsedRow[columnIndex]);
    if (!actual) return;

    compared += 1;
    if (actual === expected) matches += 1;
  });

  // Prefer rows that agree on multiple independent cells. A single match can be
  // accidental on repeated values such as dates, tiers, or participant counts.
  return { matches, compared };
}

function matchCoverageRows(parsedRows, coverage) {
  const available = new Set(coverage.map((_, index) => index));
  const matches = new Map();

  parsedRows.forEach((parsedRow, parsedIndex) => {
    let bestIndex = -1;
    let bestMatches = -1;
    let bestCompared = -1;

    available.forEach((coverageIndex) => {
      const score = coverageRowScore(parsedRow, coverage[coverageIndex] || []);
      if (
        score.matches > bestMatches
        || (score.matches === bestMatches && score.compared > bestCompared)
        || (score.matches === bestMatches && score.compared === bestCompared
          && Math.abs(coverageIndex - parsedIndex) < Math.abs(bestIndex - parsedIndex))
      ) {
        bestIndex = coverageIndex;
        bestMatches = score.matches;
        bestCompared = score.compared;
      }
    });

    // Two matches are enough for a stable row identity in ordinary tables. If
    // row counts still line up, allow the same-position row as a safe fallback.
    const samePosition = coverage[parsedIndex];
    if (bestIndex >= 0 && bestMatches >= 2) {
      matches.set(parsedIndex, bestIndex);
      available.delete(bestIndex);
    } else if (samePosition && available.has(parsedIndex)) {
      matches.set(parsedIndex, parsedIndex);
      available.delete(parsedIndex);
    }
  });

  return matches;
}

function clearDuplicatedColspanValues(parsed, source) {
  if (!parsed?.headers?.length || !Array.isArray(parsed.rows)) return parsed;

  const core = window.__TableSnapCore;
  const dataTable = core?.resolveDataTable?.(source) || source;
  const dataRows = getDataRows(dataTable);
  if (!dataRows.length) return parsed;

  const coverage = buildSpanCoverage(dataRows);
  const rowMatches = matchCoverageRows(parsed.rows, coverage);
  let changed = false;

  const rows = parsed.rows.map((row, parsedRowIndex) => {
    const coverageIndex = rowMatches.get(parsedRowIndex);
    if (coverageIndex === undefined) return row;

    const coverageRow = coverage[coverageIndex] || [];
    const next = [...row];

    coverageRow.forEach((slot, columnIndex) => {
      if (!slot?.colspanContinuation || columnIndex >= next.length) return;

      // Only blank a continuation when the parser duplicated the spanning
      // cell's value into that logical column. This avoids touching unrelated
      // compacted/decorative columns.
      const current = normalizedComparable(next[columnIndex]);
      const origin = normalizedComparable(slot.text);
      if (current && origin && current === origin) {
        next[columnIndex] = '';
        changed = true;
      }
    });

    return next;
  });

  return changed ? { ...parsed, rows } : parsed;
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
