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

export const pdfExporter = {
  id: 'pdf',
  label: 'PDF',
  extension: 'pdf',
  mimeType: 'application/pdf',
  copyable: false,
  async createBlob({ headers, rows }, options = {}) {
    const orientation = options.orientation || resolveOrientation(headers);
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
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0
    });

    return doc.output('blob');
  }
};
