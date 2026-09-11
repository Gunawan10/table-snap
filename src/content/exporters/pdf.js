import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

function resolveOrientation(headers) {
  return headers.length > 5 ? 'landscape' : 'portrait';
}

function resolveFontSize(headers) {
  if (headers.length >= 10) return 7;
  if (headers.length >= 7) return 8;
  return 9;
}

function shouldUseHorizontalPageBreak(headers) {
  return headers.length >= 7;
}

function normalizedLength(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .reduce((total, line) => total + Math.min(line.trim().length, 80), 0);
}

function resolveColumnStyles(headers, rows, availableWidth) {
  if (!headers.length || headers.length >= 7) return {};

  const minimum = headers.length <= 4 ? 62 : 48;
  const reserved = minimum * headers.length;
  const flexible = Math.max(0, availableWidth - reserved);

  const weights = headers.map((header, columnIndex) => {
    const sample = rows.slice(0, 30).map((row) => normalizedLength(row[columnIndex]));
    const average = sample.length
      ? sample.reduce((sum, length) => sum + length, 0) / sample.length
      : 0;
    return Math.max(8, normalizedLength(header), Math.min(average, 80));
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return Object.fromEntries(weights.map((weight, index) => [index, {
    cellWidth: minimum + (flexible * (weight / totalWeight))
  }]));
}

export const pdfExporter = {
  id: 'pdf',
  label: 'PDF',
  extension: 'pdf',
  mimeType: 'application/pdf',
  copyable: false,
  async createBlob({ headers, rows }, options = {}) {
    const orientation = options.orientation || resolveOrientation(headers);
    const horizontalPageBreak = shouldUseHorizontalPageBreak(headers);
    const doc = new jsPDF({
      orientation,
      unit: 'pt',
      format: options.pageSize || 'a4',
      compress: true
    });

    const margin = 32;
    const pageWidth = doc.internal.pageSize.getWidth();
    const columnStyles = resolveColumnStyles(headers, rows, pageWidth - (margin * 2));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: margin,
      margin,
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        fontSize: resolveFontSize(headers),
        cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [214, 220, 228],
        lineWidth: 0.5,
        textColor: [31, 41, 55],
        minCellHeight: 18
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: [31, 41, 55],
        textColor: [255, 255, 255],
        lineColor: [31, 41, 55],
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles,
      showHead: 'everyPage',
      horizontalPageBreak,
      horizontalPageBreakRepeat: horizontalPageBreak ? 0 : undefined,
      rowPageBreak: 'avoid'
    });

    return doc.output('blob');
  }
};
