---
id: 5
group: "documentation"
dependencies: [2, 3, 4]
status: "completed"
created: 2026-07-07
skills:
  - technical-writing
---
# Document the freshness primitive and its surfaces

## Objective
Document `kenkeep freshness` and its three surfaces so users and agents understand what the signal means, that it is read-only and advisory, that baselines are derived from git history (and therefore need a git repo with useful history), and how it appears in `doctor`, `status`, and the SessionStart advisory.

## Skills Required
Technical writing against the existing docs set (CLI/commands reference, internals architecture, hooks internals).

## Acceptance Criteria
- [ ] The CLI/commands documentation describes `kenkeep freshness`: purpose ("which nodes may describe code that changed since curation"), read-only/advisory nature, `--verbose` behavior, that it exits zero, and the git-history baseline (no stamp, no state, best-effort on shallow clones).
- [ ] Any command index/table that enumerates the deterministic primitives (e.g. the "CLI is split into launchers and primitives" list) includes `freshness`.
- [ ] The internals/hooks documentation notes the new `doctor` advisory check, the `status` line, and the fail-open, budgeted SessionStart advisory line.
- [ ] Docs state the node→code mapping in one sentence (body-referenced tracked paths ∪ tracked `kk_derived_from`) and that session-log/URL/untracked references are ignored.
- [ ] No schema-change or new-state documentation is added (there is none); the follow-up CI check and richer stamping are noted as out of scope where relevant.
- [ ] `npm run lint` (and any docs link check the repo runs) passes with the new content.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Match the tone and structure of the surrounding docs; add `freshness` alongside the other primitives rather than a standalone page unless the docs layout calls for one.
- Update `docs/internals/architecture.md` (or the doc that lists primitives) and the hooks internals doc referenced by AGENTS.md; keep AGENTS.md itself unchanged unless a durable convention was learned (route that through curation, not a hand-edit).
- Reflect the final command flags/output as implemented in Tasks 2–4; verify wording against the actual `--help` and outputs.

## Input Dependencies
Tasks 2, 3, and 4 (the command and the doctor/status/SessionStart surfaces must exist so the docs describe real behavior).

## Output Artifacts
Updated documentation files (CLI/commands reference, internals architecture, hooks internals, primitive index). No code changes.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Locate the docs to edit with `rg -n "index rebuild|deterministic primitives|## Commands|lint`, `status`, `doctor" docs/ README.md` and the AGENTS.md primitives list; add `freshness` to the same enumerations.
3. Verify every documented flag/output against the built CLI (`node dist/cli.js freshness --help`) so docs match reality.
4. This is a docs-only task — no new tests. State that explicitly and ensure `npm run lint` stays green.
</details>
