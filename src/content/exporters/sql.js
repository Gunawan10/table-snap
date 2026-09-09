function normalizeIdentifier(value, index) {
  const normalized = String(value || `column_${index + 1}`)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `column_${index + 1}`;
}

function uniqueIdentifiers(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = normalizeIdentifier(header, index);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function sqlValue(value) {
  const text = String(value ?? '');
  if (text === '') return "''";
  return `'${text.replace(/'/g, "''")}'`;
}

export const sqlExporter = {
  id: 'sql',
  label: 'SQL',
  extension: 'sql',
  mimeType: 'application/sql;charset=utf-8',
  copyable: true,
  serialize({ headers, rows }, options = {}) {
    const columns = uniqueIdentifiers(headers);
    const tableName = normalizeIdentifier(options.tableName || 'table_data', 0);
    const columnList = columns.map(quoteIdentifier).join(', ');

    return rows.map((row) => {
      const values = columns.map((_, index) => sqlValue(row[index] ?? '')).join(', ');
      return `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${values});`;
    }).join('\n');
  }
};
