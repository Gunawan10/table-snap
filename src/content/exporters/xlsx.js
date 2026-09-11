import * as XLSX from 'xlsx';

const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 48;

function textLines(value) {
  return String(value ?? '').split(/\r?\n/);
}

function measureColumnWidth(header, values) {
  const candidates = [header, ...values]
    .flatMap(textLines)
    .map((line) => line.length);
  const longest = Math.max(0, ...candidates);
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + 2));
}

function estimateRowHeight(row) {
  const lines = Math.max(1, ...row.map((value) => textLines(value).length));
  return Math.min(90, Math.max(20, 18 + ((lines - 1) * 13)));
}

function applyWorksheetLayout(worksheet, headers, rows) {
  worksheet['!cols'] = headers.map((header, columnIndex) => ({
    wch: measureColumnWidth(header, rows.map((row) => row[columnIndex]))
  }));

  worksheet['!rows'] = [
    { hpt: 22 },
    ...rows.map((row) => ({ hpt: estimateRowHeight(row) }))
  ];

  if (headers.length) {
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(rows.length, 0), c: headers.length - 1 }
      })
    };
  }
}

export const xlsxExporter = {
  id: 'xlsx',
  label: 'XLSX',
  extension: 'xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  copyable: false,
  async createBlob({ headers, rows }) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    applyWorksheetLayout(worksheet, headers, rows);

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: 'TableSnap Export',
      Creator: 'TableSnap'
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Table');

    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([output], { type: this.mimeType });
  }
};
