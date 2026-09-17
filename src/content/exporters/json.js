function toSnakeCase(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized || fallback;
}

function uniqueKeys(headers) {
  const seen = new Map();

  return headers.map((header, index) => {
    const base = toSnakeCase(header, `column_${index + 1}`);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export const jsonExporter = {
  id: 'json',
  label: 'JSON',
  extension: 'json',
  mimeType: 'application/json;charset=utf-8',
  serialize({ headers, rows }, options = {}) {
    const useObjects = options.headersAsKeys !== false && options.includeHeaders !== false;
    let payload;

    if (useObjects) {
      const keys = uniqueKeys(headers);
      payload = rows.map((row) => {
        const item = {};
        keys.forEach((key, index) => {
          const value = row[index] ?? '';
          if (options.includeEmptyValues === false && value === '') return;
          item[key] = value;
        });
        return item;
      });
    } else {
      payload = rows.map((row) => headers.map((_, index) => row[index] ?? ''));
    }

    return JSON.stringify(payload, null, options.prettyPrint === false ? 0 : (Number(options.indentation) || 2));
  }
};
