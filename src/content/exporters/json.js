function uniqueKeys(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export const jsonExporter = {
  id: 'json',
  label: 'JSON',
  extension: 'json',
  mimeType: 'application/json;charset=utf-8',
  serialize({ headers, rows }) {
    const keys = uniqueKeys(headers);
    const items = rows.map((row) => Object.fromEntries(
      keys.map((key, index) => [key, row[index] ?? ''])
    ));
    return JSON.stringify(items, null, 2);
  }
};
