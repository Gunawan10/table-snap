# TableSnap

TableSnap is a local-first Chrome extension for exporting HTML tables as CSV, Markdown, or PNG.

## MVP

- Detect visible HTML `<table>` elements, including tables added after page load.
- Hover or always-visible export icon with configurable position and size.
- Floating export card with CSV, Markdown, and image actions.
- Logical-grid parser for `colspan`, `rowspan`, nested headers, multi-row headers, `thead`, `tbody`, and `tfoot`.
- CSV delimiter setting: comma, semicolon, or tab.
- PNG scale setting: 1x, 2x, or 3x.
- Light, dark, or system popup theme.
- Settings stored in `chrome.storage.local`.
- No backend, account, API, OCR, or AI.

## Development

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select generated `dist/` folder.

## Privacy

TableSnap runs locally in browser. Table content is not sent to server.
