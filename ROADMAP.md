# TableSnap Roadmap

Last updated: 16 September 2026

This document defines product direction and release sequencing. GitHub Issues contain executable task scope and acceptance criteria.

## Product positioning

**Fastest way to capture and export tables from the web.**

TableSnap wins through:

- A fast capture flow
- Clean, simple UX
- Strong support for real-world web tables
- Broad data and visual export formats
- Local-first processing
- No account or backend requirement

## Release principles

- Release only when planned behavior is complete and verified.
- Patch releases may ship whenever a focused fix is safe.
- Minor releases should remain small enough to understand and roll back.
- Dates are targets, not reasons to ship incomplete work.
- Quick export remains available as advanced workflows are introduced.
- Every new parsing behavior should gain a regression fixture.
- Chrome Web Store publishing always requires an explicit human decision.

## Released

### v1.0.0 — Initial release

Released: 1 September 2026

- HTML table detection
- CSV, Markdown, and PNG export
- CSV and Markdown copy
- Popup settings
- Theme and accent controls
- Local-first processing

### v1.0.1 — Stability and fixes

Released: September 2026

- Export edge-case fixes
- Improved hidden row and column detection
- Cleaner cell-text extraction
- Improved sticky, frozen, split, and merged header handling
- Wide and horizontally scrollable PNG improvements
- `tfoot` support
- Filename and export-card positioning improvements
- Visible export failure states
- General UI and feedback fixes

### v1.1.0 — Modern tables and expanded export

Released: September 2026

- Native HTML, ARIA table/grid, div-based, and CSS Grid detection
- Dynamic table support
- Shared normalized parsing improvements
- CSV, XLSX, JSON, Markdown, PNG, PDF, TSV, HTML, SQL, and NDJSON exports
- Copy support for text-based formats
- Format-specific settings
- Expanded export-card and settings UI
- Self-contained local PDF generation
- Manifest V3 remote-code build validation

## Active milestone

### v1.2.0 — Capture Studio and export control

Target: 24 September–5 October 2026

Goal: evolve TableSnap from `detect → export` into `capture → clean → export` without making quick export slower.

Planned outcomes:

- Preview captured table data
- Hide, show, and reorder columns
- Select and filter rows
- Rename headers
- Preserve meaningful links
- Generate and edit safe filenames
- Reset cleanup changes
- Apply one cleanup result consistently across exporters
- Preserve existing one-click quick export

Execution order:

1. Automated regression test foundation — TS-111 / issue #1
2. Capture Studio data model and integration boundary — TS-120 / issue #2
3. Studio shell and preview — TS-121 / issue #3
4. Column controls — TS-122 / issue #4
5. Row controls — TS-123 / issue #5
6. Header cleanup and reordering — TS-124 / issue #6
7. Link, filename, and reset behavior — TS-125 / issue #7
8. Shared exporter integration — TS-126 / issue #8
9. Release verification — TS-127 / issue #9

## Planned milestones

### v1.3.0 — Multi-table and advanced export

Target: 8–18 October 2026

- Detect multiple tables on one page
- Select tables to export
- Batch and ZIP export
- XLSX multi-sheet export
- Expanded JSON export options
- Clear progress and failure handling for batch work

Before implementation, split this milestone into dependency-aware GitHub issues based on the shipped v1.2 architecture.

### v1.4.0 — Advanced table handling

Target: 24 October–5 November 2026

- Virtualized table support
- Infinite-scroll capture
- Pagination merge
- Shadow DOM support
- Better sticky and split header handling
- Compatibility work for common data-grid libraries

Each supported grid pattern must have a sanitized regression fixture. Do not claim generic data-grid support from one library-specific fix.

### v1.5.0 — Capture and OCR

Target: 15–25 November 2026

- Manual area selection
- Screenshot table capture
- Image-to-table extraction
- OCR result preview and cleanup
- CSV and XLSX export

This milestone requires a product decision before implementation because OCR may affect dependencies, extension size, permissions, performance, and the local-first guarantee.

### v1.6.0 — PDF table input

Target: December 2026

- Detect tables in user-selected PDF files
- Select and preview extracted tables
- Clean extracted data
- Export to CSV and XLSX

This milestone concerns PDF input. Existing PDF output already ships in v1.1.0. Implementation requires a separate architecture and privacy review.

## Not currently planned

These require an explicit product decision before entering the execution queue:

- Accounts or authentication
- Cloud sync
- Server-side processing
- Analytics or telemetry
- Paid APIs
- AI-assisted cleanup
- Uploading captured page or table data
- Broadening extension permissions without a documented need
