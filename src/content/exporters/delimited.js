export function escapeDelimitedValue(value, delimiter) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (text.includes('"') || text.includes('\n') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toDelimited({ headers, rows }, delimiter) {
  return [headers, ...rows]
    .map((row) => row.map((value) => escapeDelimitedValue(value, delimiter)).join(delimiter))
    .join('\r\n');
}
