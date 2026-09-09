import * as XLSX from 'xlsx';

export const xlsxExporter = {
  id: 'xlsx',
  label: 'XLSX',
  extension: 'xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  copyable: false,
  async createBlob({ headers, rows }) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Table');
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([output], { type: this.mimeType });
  }
};
