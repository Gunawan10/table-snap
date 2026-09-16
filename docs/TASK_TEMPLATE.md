# Task specification template

Use this template when turning a roadmap outcome or production bug into a GitHub issue.

## Title

`[Ready|Blocked] TS-### — Short outcome`

## Goal

One user or engineering outcome. Explain why it matters.

## Scope

- Concrete behavior included in this task
- Important files or boundaries
- Explicit compatibility requirements

## Out of scope

- Related work intentionally deferred
- Product decisions this task must not make

## Acceptance criteria

- Observable behavior
- Required edge cases
- Regression coverage
- `npm test`
- `npm run build`
- Any honest manual-verification requirement

## Status

Ready or Blocked

## Dependencies

Task IDs or None

## Risk and rollback

- Main regression risk
- Safe rollback boundary

## Autonomous execution

State whether Codex may merge after all checks pass. Use one of:

- Codex may implement, verify, open a PR, and merge after every acceptance criterion passes.
- Codex may implement, verify, and open a PR; human browser QA is required before merge.
