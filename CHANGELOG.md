# Changelog

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
