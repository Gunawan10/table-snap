import { toDelimited } from './delimited.js';

export const tsvExporter = {
  id: 'tsv',
  label: 'TSV',
  extension: 'tsv',
  mimeType: 'text/tab-separated-values;charset=utf-8',
  serialize(table) {
    return `\uFEFF${toDelimited(table, '\t')}`;
  }
};
