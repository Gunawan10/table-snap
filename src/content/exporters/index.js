import { tsvExporter } from './tsv.js';
import { jsonExporter } from './json.js';
import { htmlExporter } from './html.js';

const exporters = new Map([
  [tsvExporter.id, tsvExporter],
  [jsonExporter.id, jsonExporter],
  [htmlExporter.id, htmlExporter]
]);

export function getExporter(format) {
  return exporters.get(format) || null;
}

export function listExporters() {
  return [...exporters.values()];
}

export function serializeExport(format, table) {
  const exporter = getExporter(format);
  if (!exporter) throw new Error(`Unsupported TableSnap export format: ${format}`);
  return exporter.serialize(table);
}
