function normalizeKey(value, index) {
  return String(value || `Column ${index + 1}`)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '') || `column_${index + 1}`;
}

function uniqueKeys(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = normalizeKey(header, index);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export const ndjsonExporter = {
  id: 'ndjson',
  label: 'NDJSON',
  extension: 'ndjson',
  mimeType: 'application/x-ndjson;charset=utf-8',
  copyable: true,
  serialize({ headers, rows }) {
    const keys = uniqueKeys(headers);
    return rows
      .map((row) => JSON.stringify(Object.fromEntries(
        keys.map((key, index) => [key, row[index] ?? ''])
      )))
      .join('\n');
  }
};
