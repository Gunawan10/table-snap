# TableSnap Task Queue

Last updated: 16 September 2026

GitHub Issues are the source of truth for task status, dependencies, acceptance criteria, and discussion. This file is a compact execution map for humans and coding agents.

## Authorization rules

- `Planned` means documented but not authorized for implementation.
- Only the user can move a planned task or milestone into active work.
- Do not infer authorization from roadmap dates, issue ordering, or a request to organize the project.
- Once the user authorizes a task, Codex may complete its implementation, verification, branch, and PR without routine follow-up.
- Keep one authorized issue per branch and pull request.
- Do not start a dependent issue until its prerequisites are complete and the user has authorized the next work.

## Planned — not authorized

| ID | Issue | Status | Depends on | Outcome |
| --- | ---: | --- | --- | --- |
| TS-111 | [#1](https://github.com/Gunawan10/table-snap/issues/1) | Planned | — | Automated regression test foundation |
| TS-120 | [#2](https://github.com/Gunawan10/table-snap/issues/2) | Planned | TS-111 | Capture Studio model and boundaries |
| TS-121 | [#3](https://github.com/Gunawan10/table-snap/issues/3) | Planned | TS-120 | Studio shell and preview |
| TS-122 | [#4](https://github.com/Gunawan10/table-snap/issues/4) | Planned | TS-121 | Column visibility and order |
| TS-123 | [#5](https://github.com/Gunawan10/table-snap/issues/5) | Planned | TS-121 | Row selection and filtering |
| TS-124 | [#6](https://github.com/Gunawan10/table-snap/issues/6) | Planned | TS-121 | Header cleanup and reordering |
| TS-125 | [#7](https://github.com/Gunawan10/table-snap/issues/7) | Planned | TS-122, TS-123, TS-124 | Links, filename, and reset |
| TS-126 | [#8](https://github.com/Gunawan10/table-snap/issues/8) | Planned | TS-122, TS-123, TS-124, TS-125 | Shared exporter integration |
| TS-127 | [#9](https://github.com/Gunawan10/table-snap/issues/9) | Planned | TS-126 | v1.2 verification and release prep |

## Next milestone intake

Do not create implementation issues for v1.3 until TS-120 defines the shared snapshot and TS-126 proves the exporter boundary. Near the end of v1.2, create dependency-aware issues for:

- Multiple-table detection and selection
- Batch export state
- ZIP packaging
- XLSX multi-sheet output
- Batch progress and failure recovery
- v1.3 regression and release preparation

## Agent handoff

A new Codex session should be able to continue with this instruction:

> Read AGENTS.md, ROADMAP.md, and TASKS.md. Do not start a roadmap task unless the user explicitly authorizes it. For an authorized task, execute it autonomously within its acceptance criteria, verify the result, and open a focused PR.

No additional project recap should be necessary after the user identifies the task or milestone to start.
