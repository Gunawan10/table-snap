# AGENTS.md

## Purpose

This file defines the standing instructions for coding agents working in TableSnap. Read it before making changes, together with `README.md`, `ROADMAP.md`, and the selected GitHub issue.

## Product

TableSnap is a Chrome Manifest V3 extension for capturing tables from web pages and exporting them locally.

Core positioning:

> Fastest way to capture and export tables from the web.

Non-negotiable product principles:

- Keep the common capture-to-export path fast and simple.
- Process table data locally in the browser.
- Do not add accounts, backend services, server uploads, analytics, paid APIs, AI APIs, or runtime remote code unless a separately approved product decision changes this.
- Preserve support for native tables, merged cells, multi-row headers, ARIA tables/grids, div-based layouts, CSS Grid layouts, dynamic content, wide tables, and sticky/split layouts.
- Do not trade existing quick export for Capture Studio. Both flows must remain available.

## Sources of truth

Use these sources in this order:

1. The selected GitHub issue: exact task scope, dependencies, and acceptance criteria.
2. This `AGENTS.md`: standing engineering and product constraints.
3. `ROADMAP.md`: release direction and sequencing.
4. `README.md`: currently shipped behavior.
5. `CHANGELOG.md`: historical release behavior.

GitHub Issues are the execution queue. `TASKS.md` is a human-readable index, not a second issue tracker.

## Command-gated autonomous workflow

Roadmap entries and GitHub issues are plans, not authorization to implement them.

Before a task is authorized, Codex may audit the repository and organize or clarify ROADMAP.md, TASKS.md, and GitHub Issues. It may not create an implementation branch, change product code, or start a feature.

Do not start a task, milestone, scheduled implementation run, branch, code change, or PR unless the user explicitly authorizes that task or milestone. Phrases such as "set up Codex", "organize the roadmap", or "manage the project" authorize project-management cleanup only, not feature implementation.

After the user explicitly authorizes a task:

1. Inspect the selected issue and confirm its dependencies are complete.
2. Change its title prefix to `[In Progress]`.
3. Create a focused branch named `codex/TS-<id>-<short-name>`.
4. Write a short implementation plan, then proceed without requesting routine follow-up.
5. Implement only that issue.
6. Add or update regression coverage.
7. Run all required verification.
8. Inspect the complete diff for unrelated changes, secrets, generated output, and scope creep.
9. Open a PR that links the issue.
10. Stop at the open PR and report verification results and any manual QA gaps.

Never merge a PR. The user reviews and merges it. Autonomy applies after task authorization; it does not grant permission to choose the next roadmap feature. Do not start multiple tasks that edit the same hotspot files.

## When human input is required

Continue autonomously for normal implementation choices. Stop and request a decision only when work requires one of these:

- Changing product scope, pricing, privacy posture, permissions, or local-first behavior.
- Adding a production dependency or external service.
- Destructive or irreversible repository operations.
- Publishing a Chrome Web Store release.
- Choosing between materially different UX directions not resolved by the issue or roadmap.
- Handling credentials, billing, legal text, or user data.
- Bypassing a failing required check.

Do not request confirmation for ordinary refactors, test additions, bug fixes, branch creation, commits, or PR creation within an approved issue.

## Engineering rules

- Use plain JavaScript, HTML, and CSS unless the roadmap explicitly approves a migration.
- Preserve Chrome Manifest V3 compatibility.
- Never introduce `eval`, `new Function`, remotely hosted JavaScript, or runtime code downloads.
- Keep `dist/` generated and out of source control.
- Prefer small modules with explicit inputs and outputs.
- Maintain one normalized table representation across structured exporters.
- Keep cleanup transformations non-destructive: preserve the captured source snapshot and derive transformed output.
- Avoid format-specific reparsing of the page.
- Preserve accessible keyboard behavior, visible focus, light/dark themes, and source-page isolation.
- Do not silently discard merged-cell meaning, multiline content, list items, or meaningful links.
- Do not broaden extension permissions without an explicit issue explaining why.

## Dependencies

- A new production dependency requires a human decision.
- A dev dependency may be added autonomously only when it materially improves repeatable testing or build verification, is well maintained, and is explained in the PR.
- Commit and maintain the npm lockfile once introduced.
- Never load dependencies from a CDN at runtime.

## Verification

For documentation-only changes:

- Check internal links, issue references, commands, versions, and roadmap consistency.

For code, build, or dependency changes, run:

```bash
npm install
npm test
npm run build
```

Once a lockfile exists, prefer:

```bash
npm ci
npm test
npm run build
```

Also:

- Verify the build's Manifest V3 remote-code check passes.
- Add regression coverage for fixed or introduced behavior.
- Report any Chrome-only interaction that automation could not verify.
- Never claim manual browser verification was performed unless it actually was.

## Git and PR rules

- Branch from the latest `main`.
- One issue per branch and PR.
- Use Conventional Commit prefixes such as `feat:`, `fix:`, `test:`, `docs:`, and `chore:`.
- Keep commits reviewable and avoid unrelated formatting churn.
- Never force-push `main`.
- Do not rewrite user-authored history.
- PR descriptions must include summary, linked issue, verification results, manual verification gaps, and risk/rollback notes.
- Version bumps belong only in release-preparation tasks unless the issue explicitly requires one.

## High-risk areas

Treat these as regression-sensitive:

- `src/content/content-script.js`
- `src/content/modern-table-support.js`
- `src/content/native-colspan-fix.js`
- `src/content/semantic-cell-content.js`
- `src/content/expanded-export-support.js`
- `src/content/exporters/`
- `manifest.json`
- `scripts/build.mjs`

Changes in these areas require focused tests plus a full build.
