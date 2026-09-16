# TableSnap Task Queue

Last updated: 16 September 2026

GitHub Issues are the source of truth for task status, dependencies, acceptance criteria, and discussion. This file is a compact execution map for humans and coding agents.

## Queue rules

- Work only on tasks marked `[Ready]`.
- Work on the lowest-numbered ready issue unless a higher-priority production bug exists.
- Change the issue to `[In Progress]` before implementation.
- Keep one issue per branch and pull request.
- Do not start a blocked issue until all listed dependencies are complete.
- After merging a task, close it and promote newly unblocked tasks to `[Ready]`.
- A production regression may interrupt this queue; document why in the issue and PR.

## Active

| ID | Issue | Status | Depends on | Outcome |
| --- | ---: | --- | --- | --- |
| TS-111 | [#1](https://github.com/Gunawan10/table-snap/issues/1) | Ready | — | Automated regression test foundation |
| TS-120 | [#2](https://github.com/Gunawan10/table-snap/issues/2) | Blocked | TS-111 | Capture Studio model and boundaries |
| TS-121 | [#3](https://github.com/Gunawan10/table-snap/issues/3) | Blocked | TS-120 | Studio shell and preview |
| TS-122 | [#4](https://github.com/Gunawan10/table-snap/issues/4) | Blocked | TS-121 | Column visibility and order |
| TS-123 | [#5](https://github.com/Gunawan10/table-snap/issues/5) | Blocked | TS-121 | Row selection and filtering |
| TS-124 | [#6](https://github.com/Gunawan10/table-snap/issues/6) | Blocked | TS-121 | Header cleanup and reordering |
| TS-125 | [#7](https://github.com/Gunawan10/table-snap/issues/7) | Blocked | TS-122, TS-123, TS-124 | Links, filename, and reset |
| TS-126 | [#8](https://github.com/Gunawan10/table-snap/issues/8) | Blocked | TS-122, TS-123, TS-124, TS-125 | Shared exporter integration |
| TS-127 | [#9](https://github.com/Gunawan10/table-snap/issues/9) | Blocked | TS-126 | v1.2 verification and release prep |

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

> Read AGENTS.md, ROADMAP.md, and TASKS.md. Inspect open GitHub issues, choose the lowest-numbered Ready task, execute it autonomously within its acceptance criteria, verify the result, open a focused PR, and update dependent task status.

No additional project recap should be necessary.
