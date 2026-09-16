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

## Execution authorization

Roadmap inclusion does not authorize implementation. Record who or what authorized the task.

After authorization, Codex may implement, verify, and open a PR. Codex must not merge the PR. Document any manual browser QA required before the user reviews and merges it.
