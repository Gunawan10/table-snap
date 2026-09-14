const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792]
};

const MARGIN = 32;
const CELL_PADDING_X = 5;
const CELL_PADDING_Y = 5;
const MIN_COLUMN_WIDTH = 48;
const MAX_COLUMN_WIDTH = 180;
const MIN_ROW_HEIGHT = 19;

function resolveOrientation(headers) {
  return headers.length > 5 ? 'landscape' : 'portrait';
}

function resolveFontSize(headers) {
  if (headers.length >= 10) return 7;
  if (headers.length >= 7) return 8;
  return 9;
}

function pageDimensions(pageSize, orientation) {
  const base = PAGE_SIZES[String(pageSize || 'a4').toLowerCase()] || PAGE_SIZES.a4;
  const [width, height] = base;
  return orientation === 'landscape' ? [height, width] : [width, height];
}

function asciiText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function escapePdfText(value) {
  return asciiText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function maxLineLength(value) {
  return asciiText(value)
    .split('\n')
    .reduce((max, line) => Math.max(max, line.length), 0);
}

function estimateColumnWidth(header, values, fontSize) {
  const longest = Math.max(
    maxLineLength(header),
    ...values.slice(0, 40).map(maxLineLength)
  );
  return Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, (longest * fontSize * 0.53) + (CELL_PADDING_X * 2))
  );
}

function buildColumnGroups(headers, rows, availableWidth, fontSize) {
  const widths = headers.map((header, columnIndex) => estimateColumnWidth(
    header,
    rows.map((row) => row[columnIndex]),
    fontSize
  ));

  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= availableWidth) {
    const extra = Math.max(0, availableWidth - total);
    const expanded = widths.map((width) => width + (extra / Math.max(1, widths.length)));
    return [{ indexes: headers.map((_, index) => index), widths: expanded }];
  }

  const groups = [];
  const repeatFirst = headers.length > 1;
  let start = repeatFirst ? 1 : 0;

  while (start < headers.length || (!headers.length && !groups.length)) {
    const indexes = repeatFirst ? [0] : [];
    const groupWidths = repeatFirst ? [Math.min(widths[0], availableWidth * 0.32)] : [];
    let used = groupWidths.reduce((sum, width) => sum + width, 0);
    let index = start;

    while (index < headers.length) {
      const remaining = availableWidth - used;
      const width = Math.min(widths[index], Math.max(MIN_COLUMN_WIDTH, remaining));
      if (indexes.length && remaining < MIN_COLUMN_WIDTH) break;
      indexes.push(index);
      groupWidths.push(width);
      used += width;
      index += 1;
      if (availableWidth - used < MIN_COLUMN_WIDTH) break;
    }

    if (!indexes.length && headers.length) {
      indexes.push(start);
      groupWidths.push(availableWidth);
      index = start + 1;
    }

    const slack = Math.max(0, availableWidth - groupWidths.reduce((sum, width) => sum + width, 0));
    if (slack && groupWidths.length) {
      const addition = slack / groupWidths.length;
      for (let i = 0; i < groupWidths.length; i += 1) groupWidths[i] += addition;
    }

    groups.push({ indexes, widths: groupWidths });
    if (!headers.length || index <= start) break;
    start = index;
  }

  return groups.length ? groups : [{ indexes: [], widths: [] }];
}

function splitLongWord(word, maxChars) {
  if (word.length <= maxChars) return [word];
  const chunks = [];
  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }
  return chunks;
}

function wrapText(value, width, fontSize) {
  const safeWidth = Math.max(12, width - (CELL_PADDING_X * 2));
  const maxChars = Math.max(1, Math.floor(safeWidth / (fontSize * 0.53)));
  const sourceLines = asciiText(value).split('\n');
  const output = [];

  sourceLines.forEach((sourceLine) => {
    const words = sourceLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      output.push('');
      return;
    }

    let current = '';
    words.forEach((word) => {
      const pieces = splitLongWord(word, maxChars);
      pieces.forEach((piece) => {
        const candidate = current ? `${current} ${piece}` : piece;
        if (candidate.length <= maxChars) {
          current = candidate;
        } else {
          if (current) output.push(current);
          current = piece;
        }
      });
    });
    if (current) output.push(current);
  });

  return output.length ? output : [''];
}

function cellLines(value, width, fontSize) {
  return wrapText(value, width, fontSize);
}

function rowHeight(row, indexes, widths, fontSize, lineHeight) {
  const lines = indexes.reduce((max, columnIndex, groupIndex) => Math.max(
    max,
    cellLines(row[columnIndex], widths[groupIndex], fontSize).length
  ), 1);
  return Math.max(MIN_ROW_HEIGHT, (CELL_PADDING_Y * 2) + (lines * lineHeight));
}

function commandRect(x, top, width, height, pageHeight, fill, stroke = '0.84 0.86 0.89') {
  const y = pageHeight - top - height;
  const commands = [];
  if (fill) commands.push(`${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  commands.push(`${stroke} RG 0.5 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  return commands.join('\n');
}

function commandText(text, x, top, pageHeight, fontSize, fontName = 'F1', color = '0.12 0.16 0.22') {
  const baseline = pageHeight - top - fontSize;
  return `${color} rg BT /${fontName} ${fontSize} Tf 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`;
}

function renderCell(commands, value, x, top, width, height, pageHeight, fontSize, options = {}) {
  commands.push(commandRect(x, top, width, height, pageHeight, options.fill));
  const lines = cellLines(value, width, fontSize);
  const lineHeight = fontSize + 2;
  lines.forEach((line, index) => {
    const lineTop = top + CELL_PADDING_Y + (index * lineHeight);
    if (lineTop + fontSize > top + height - 1) return;
    commands.push(commandText(
      line,
      x + CELL_PADDING_X,
      lineTop,
      pageHeight,
      fontSize,
      options.bold ? 'F2' : 'F1',
      options.textColor || '0.12 0.16 0.22'
    ));
  });
}

function renderHeader(commands, headers, group, top, pageHeight, fontSize) {
  const lineHeight = fontSize + 2;
  const maxLines = group.indexes.reduce((max, columnIndex, groupIndex) => Math.max(
    max,
    cellLines(headers[columnIndex], group.widths[groupIndex], fontSize).length
  ), 1);
  const height = Math.max(22, (CELL_PADDING_Y * 2) + (maxLines * lineHeight));
  let x = MARGIN;

  group.indexes.forEach((columnIndex, groupIndex) => {
    const width = group.widths[groupIndex];
    renderCell(commands, headers[columnIndex], x, top, width, height, pageHeight, fontSize, {
      bold: true,
      fill: '0.12 0.16 0.22',
      textColor: '1 1 1'
    });
    x += width;
  });

  return height;
}

function renderGroupPages(headers, rows, group, pageWidth, pageHeight, fontSize) {
  const pages = [];
  const lineHeight = fontSize + 2;
  const bottom = pageHeight - MARGIN;
  let commands = [];
  let top = MARGIN;
  let headerHeight = renderHeader(commands, headers, group, top, pageHeight, fontSize);
  top += headerHeight;

  rows.forEach((row, rowIndex) => {
    const height = rowHeight(row, group.indexes, group.widths, fontSize, lineHeight);
    if (top + height > bottom && top > MARGIN + headerHeight) {
      pages.push(commands.join('\n'));
      commands = [];
      top = MARGIN;
      headerHeight = renderHeader(commands, headers, group, top, pageHeight, fontSize);
      top += headerHeight;
    }

    let x = MARGIN;
    group.indexes.forEach((columnIndex, groupIndex) => {
      const width = group.widths[groupIndex];
      renderCell(commands, row[columnIndex], x, top, width, height, pageHeight, fontSize, {
        fill: rowIndex % 2 ? '0.972 0.98 0.988' : null
      });
      x += width;
    });
    top += height;
  });

  pages.push(commands.join('\n'));
  return pages;
}

function createPdfDocument(pageContents, pageWidth, pageHeight) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];

  pageContents.forEach((content) => {
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n% TableSnap local PDF exporter\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export const pdfExporter = {
  id: 'pdf',
  label: 'PDF',
  extension: 'pdf',
  mimeType: 'application/pdf',
  copyable: false,
  async createBlob({ headers, rows }, options = {}) {
    const orientation = options.orientation || resolveOrientation(headers);
    const [pageWidth, pageHeight] = pageDimensions(options.pageSize, orientation);
    const fontSize = resolveFontSize(headers);
    const availableWidth = pageWidth - (MARGIN * 2);
    const groups = buildColumnGroups(headers, rows, availableWidth, fontSize);
    const pageContents = groups.flatMap((group) => renderGroupPages(
      headers,
      rows,
      group,
      pageWidth,
      pageHeight,
      fontSize
    ));
    const pdf = createPdfDocument(pageContents, pageWidth, pageHeight);
    return new Blob([pdf], { type: this.mimeType });
  }
};
