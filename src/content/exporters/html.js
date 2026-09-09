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
  serialize({ headers, rows }) {
    const head = `<thead><tr>${headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>TableSnap Export</title></head>\n<body>\n<table>\n${head}\n${body}\n</table>\n</body>\n</html>\n`;
  }
};
