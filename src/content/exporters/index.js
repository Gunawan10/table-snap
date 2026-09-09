import { tsvExporter } from './tsv.js';
import { jsonExporter } from './json.js';
import { htmlExporter } from './html.js';
import { xlsxExporter } from './xlsx.js';
import { sqlExporter } from './sql.js';
import { ndjsonExporter } from './ndjson.js';
import { pdfExporter } from './pdf.js';

const exporters = new Map([
  [tsvExporter.id, tsvExporter],
  [jsonExporter.id, jsonExporter],
  [htmlExporter.id, htmlExporter],
  [xlsxExporter.id, xlsxExporter],
  [pdfExporter.id, pdfExporter],
  [sqlExporter.id, sqlExporter],
  [ndjsonExporter.id, ndjsonExporter]
]);

export function getExporter(format) {
  return exporters.get(format) || null;
}

export function listExporters() {
  return [...exporters.values()];
}

export function serializeExport(format, table, options = {}) {
  const exporter = getExporter(format);
  if (!exporter) throw new Error(`Unsupported TableSnap export format: ${format}`);
  if (typeof exporter.serialize !== 'function') {
    throw new Error(`TableSnap export format does not support text serialization: ${format}`);
  }
  return exporter.serialize(table, options);
}
