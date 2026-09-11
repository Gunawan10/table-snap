# Changelog

## v1.1.0

Modern table support and expanded export update.

### Added

- Support for modern table-like layouts, including ARIA tables/grids, div-based tables, and CSS Grid layouts.
- New export formats: XLSX, JSON, PDF, TSV, HTML, SQL, and NDJSON.
- Direct copy support for text-based formats.
- Format-specific settings for CSV, XLSX, PDF, and PNG.
- XLSX options for header rows, auto column width, wrap text, and autofilter.
- PDF orientation and page-size options.
- Expanded theme and accent color settings.
- Live icon preview that follows icon visibility, position, and size settings.

### Improved

- Preserve meaningful multiline content, ordered lists, and bullet points across normalized exports.
- Improve XLSX sizing and readability for multiline content.
- Improve PDF column sizing, wrapping, and wide-table handling.
- Improve PNG background detection for transparent table containers.
- Improve PNG capture reliability on pages with restrictive Content Security Policy rules.
- Refresh popup settings UI and export workflow.
- Update product positioning, metadata, and documentation for the broader capture/export scope.

## v1.0.1

Stability and export reliability update.

### Fixed

- Exclude hidden rows and cells from exports.
- Improve cell text extraction and remove decorative content.
- Improve handling for merged and decorative header columns.
- Unify Save and Copy parsing for CSV and Markdown.
- Fix sticky, frozen, and split-header table parsing.
- Prevent unrelated nearby tables from being grouped together.
- Improve export filename generation.
- Fix export card positioning near viewport edges.
- Fix card anchoring when icon visibility is set to Always.
- Improve PNG capture for solid backgrounds.
- Fix PNG export for horizontally scrollable and wide tables.
- Improve PNG handling for FixedColumns/frozen table layouts.
- Fix first-click PNG export timing issue.
- Include visible `<tfoot>` rows in CSV and Markdown exports.
- Add visible Failed state when an export operation fails.
- Add safer fallback detection for visually styled header rows when semantic table headers are missing.
