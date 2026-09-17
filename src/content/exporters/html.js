function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const htmlExporter = {
  id: 'html',
  label: 'HTML',
  extension: 'html',
  mimeType: 'text/html;charset=utf-8',
  copyable: true,
  serialize({ headers, rows }, options = {}) {
    const includeHeaders = options.includeHeaders !== false;
    const semantic = options.semanticHtml !== false;
    const minify = options.minify === true;
    const customAttributes = String(options.tableAttributes || '').trim();
    const basicStyle = options.basicStyling === true
      ? 'style="border-collapse:collapse;width:100%"'
      : '';
    const attributes = [customAttributes, basicStyle].filter(Boolean).join(' ');
    const openTable = attributes ? `<table ${attributes}>` : '<table>';

    const headerCells = headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('');
    const bodyRows = rows
      .map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('')}</tr>`)
      .join(minify ? '' : '\n');

    let tableContent = '';
    if (semantic) {
      const head = includeHeaders ? `<thead><tr>${headerCells}</tr></thead>` : '';
      const body = `<tbody>${minify ? '' : '\n'}${bodyRows}${minify ? '' : '\n'}</tbody>`;
      tableContent = [head, body].filter(Boolean).join(minify ? '' : '\n');
    } else {
      const headRow = includeHeaders ? `<tr>${headers.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>` : '';
      tableContent = [headRow, bodyRows].filter(Boolean).join(minify ? '' : '\n');
    }

    if (minify) {
      return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TableSnap Export</title></head><body>${openTable}${tableContent}</table></body></html>`;
    }

    return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>TableSnap Export</title>\n</head>\n<body>\n${openTable}\n${tableContent}\n</table>\n</body>\n</html>\n`;
  }
};
