# TableSnap

**Capture and export web tables in one click.**

TableSnap is a lightweight, local-first Chrome extension for capturing tables from modern web pages and exporting them in the format you need.

It works with classic HTML tables as well as many modern table layouts built with ARIA roles, div-based structures, and CSS Grid. Open the TableSnap card, choose a format, then save or copy the table without manually selecting rows or sending table data to a server.

## Highlights

- Detects classic HTML tables and modern table-like layouts.
- Works with dynamically rendered content.
- Supports ARIA tables and grids, div-based tables, and CSS Grid layouts.
- Preserves logical table structure including `colspan`, `rowspan`, multi-row headers, and nested headers.
- Preserves meaningful multiline content and list items where possible.
- Exports to **CSV, XLSX, JSON, Markdown, PNG, PDF, TSV, HTML, SQL, and NDJSON**.
- Supports direct copy for text-based formats.
- Captures tables as PNG while preserving page background and wide-table content.
- Offers format-specific export settings.
- Includes configurable icon behavior, themes, accent colors, and a live icon preview.
- Runs locally in the browser with no backend, account, or external API required.

## Supported Table Types

TableSnap currently supports:

- Native HTML `<table>` elements
- `thead`, `tbody`, and `tfoot`
- `colspan` and `rowspan`
- Multi-row and nested headers
- Sticky and split table layouts
- ARIA `table`, `grid`, and related row/cell roles
- Div-based table layouts
- CSS Grid table layouts
- Tables rendered dynamically after page load

Support for highly virtualized, infinite, paginated, and Shadow DOM data grids is planned for future releases.

## Export Formats

### CSV

Export spreadsheet-friendly CSV with configurable delimiter:

- Comma `,`
- Semicolon `;`
- Tab

### XLSX

Export directly to Excel-compatible `.xlsx` files.

Available settings include:

- Include header row
- Auto column width
- Wrap text
- Add autofilter

TableSnap also sizes multiline rows automatically to keep exported sheets readable.

### JSON

Export table rows as structured JSON data using normalized column headers.

### Markdown

Export Markdown tables for README files, documentation, notes, and other Markdown-based tools.

Multiline or list-style cell content is preserved in a Markdown-friendly form where possible.

### PNG

Capture the table visually using `html2canvas`.

- Configurable render scale: 1x, 2x, or 3x
- Handles wide and horizontally scrollable tables
- Uses the effective page/table background instead of exporting unexpected transparency
- Removes TableSnap UI and unnecessary embedded page elements from the capture clone

### PDF

Export tables to paginated PDF using `jsPDF` and `jspdf-autotable`.

Available settings include:

- Orientation: Auto / Portrait / Landscape
- Page size: A4 / Letter

Normal tables stay together when possible, while genuinely wide tables can split across horizontal PDF pages.

### TSV

Export tab-separated values for spreadsheet workflows and plain-text interchange.

### HTML

Export table content as HTML for reuse in documents, emails, or web projects.

### SQL

Export table rows as SQL `INSERT` statements using a safe default table alias.

### NDJSON

Export one JSON object per line for streaming, tooling, and data-processing workflows.

## Copy Support

Text-based formats can be copied directly from the export card when supported.

Current copy-friendly formats include CSV, TSV, Markdown, JSON, HTML, SQL, and NDJSON.

Binary formats such as XLSX, PDF, and PNG are save-only.

## How It Works

1. Open a page containing a supported table.
2. Hover the table or use the always-visible icon mode.
3. Click the TableSnap icon.
4. Choose a format.
5. Save the file or copy the output.
6. TableSnap processes the table locally in your browser.

No page reload required.

## Settings

TableSnap uses a compact tabbed popup with **General**, **Export**, and **Appearance** sections.

### General

- Icon visibility: On hover / Always
- Icon position: Top right / Top left
- Icon size: Small / Medium / Large
- Live preview that follows the selected icon settings

### Export

- Default export format
- CSV delimiter
- XLSX settings
  - Include header row
  - Auto column width
  - Wrap text
  - Add autofilter
- PDF orientation
- PDF page size
- PNG render scale

### Appearance

- Theme: System / Light / Dark
- Accent colors:
  - Blue
  - Violet
  - Pink
  - Red
  - Orange
  - Emerald
  - Cyan
  - Lime
- Reset settings to defaults

The main toggle can disable TableSnap completely. Settings are persisted with `chrome.storage.local`.

## Privacy

TableSnap is local-first by design.

- No account required
- No backend server
- No external API required
- No AI processing required
- Table contents are not uploaded by TableSnap

Parsing and export generation happen inside the browser.

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript
- HTML
- CSS
- `chrome.storage.local`
- `MutationObserver`
- `html2canvas`
- `xlsx`
- `jsPDF`
- `jspdf-autotable`
- esbuild
- Sharp for extension icon assets during build

## Development

Requirements:

- Node.js
- npm
- Chromium-based browser such as Google Chrome

Install dependencies:

```bash
npm install
```

Build extension:

```bash
npm run build
```

Build output is generated in:

```text
dist/
```

## Load Extension Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist/` directory.
5. Open any page containing a supported table.

After making code changes:

```bash
npm run build
```

Then reload TableSnap from `chrome://extensions`.

## Project Structure

```text
.
├── manifest.json
├── scripts/
│   └── build.mjs
├── src/
│   ├── assets/
│   ├── background/
│   ├── content/
│   │   └── exporters/
│   └── popup/
└── dist/
```

`dist/` is generated by the build process and is the directory loaded into Chrome.

## Roadmap

Near-term direction:

- Capture Studio for preview and cleanup before export
- Column selection and reordering
- Row filtering and selection
- Header renaming
- Multi-table export
- Better support for virtualized and infinite data grids
- Shadow DOM compatibility
- OCR-based table capture
- PDF table extraction

## License

Licensed under the MIT License. See [`LICENSE`](LICENSE) for details.
