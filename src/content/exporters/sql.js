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

function identifierQuote(dialect) {
  return dialect === 'mysql' ? '`' : '"';
}

function quoteIdentifier(value, options) {
  if (options.quoteIdentifiers === false) return String(value);
  const quote = identifierQuote(options.dialect || 'mysql');
  return `${quote}${String(value).replaceAll(quote, quote + quote)}${quote}`;
}

function sqlValue(value, options) {
  const text = String(value ?? '');
  if (text === '' && options.nullEmptyValues === true) return 'NULL';
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
    const table = normalizeIdentifier(options.tableName || 'table_data', 0);
    const tableName = quoteIdentifier(table, options);
    const columnList = options.includeColumnNames === false
      ? ''
      : ` (${columns.map((column) => quoteIdentifier(column, options)).join(', ')})`;
    const valueGroups = rows.map((row) => `(${columns.map((_, index) => sqlValue(row[index] ?? '', options)).join(', ')})`);

    if (!valueGroups.length) return '';
    if (options.multiRowInsert === true) {
      return `INSERT INTO ${tableName}${columnList} VALUES\n${valueGroups.map((group, index) => `  ${group}${index === valueGroups.length - 1 ? ';' : ','}`).join('\n')}`;
    }
    return valueGroups.map((values) => `INSERT INTO ${tableName}${columnList} VALUES ${values};`).join('\n');
  }
};
