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

function applyWrapText(worksheet, range) {
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        alignment: {
          ...(cell.s?.alignment || {}),
          wrapText: true,
          vertical: 'top'
        }
      };
    }
  }
}

function applyWorksheetLayout(worksheet, headers, rows, options, headerOffset) {
  if (options.autoColumnWidth !== false) {
    worksheet['!cols'] = headers.map((header, columnIndex) => ({
      wch: measureColumnWidth(header, rows.map((row) => row[columnIndex]))
    }));
  }

  if (options.wrapText !== false) {
    worksheet['!rows'] = [
      ...(headerOffset ? [{ hpt: 22 }] : []),
      ...rows.map((row) => ({ hpt: estimateRowHeight(row) }))
    ];

    if (worksheet['!ref']) applyWrapText(worksheet, XLSX.utils.decode_range(worksheet['!ref']));
  }

  if (options.autoFilter !== false && headerOffset && headers.length) {
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
  async createBlob({ headers, rows }, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const data = includeHeader ? [headers, ...rows] : rows;
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    applyWorksheetLayout(worksheet, headers, rows, options, includeHeader ? 1 : 0);

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: 'TableSnap Export',
      Creator: 'TableSnap'
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Table');

    const output = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true
    });
    return new Blob([output], { type: this.mimeType });
  }
};
