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
  // Normal tables should stay together on one page width and wrap long cell text.
  // Only genuinely wide tables should split columns across horizontal PDF pages.
  return headers.length >= 7;
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

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      margin: 36,
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        fontSize: resolveFontSize(headers),
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold'
      },
      showHead: 'everyPage',
      horizontalPageBreak,
      horizontalPageBreakRepeat: horizontalPageBreak ? 0 : undefined
    });

    return doc.output('blob');
  }
};
