---
id: 5
group: "docs"
dependencies: [1, 2, 3]
status: "pending"
created: 2026-05-13
skills:
  - markdown
---

# Document the new `conflict` subcommands in README and CHANGELOG

## Objective

Make the new CLI surface visible to users: list `conflict list` and `conflict resolve` next to the existing commands in `README.md`, and record the change (plus the `init --upgrade` step) in `CHANGELOG.md`.

## Skills Required

- `markdown`: add entries to the existing command table / list in `README.md` and append a changelog entry.

## Acceptance Criteria

- [ ] `README.md` mentions both `ai-knowledge-base conflict list` and `ai-knowledge-base conflict resolve <id> --action <replace|reject>` next to the other top-level commands (e.g. `curate`, `status`, `lint`, `index rebuild`). The wording explains, in one short paragraph or two rows, that `conflict list` prints pending conflicts as JSON and `conflict resolve` applies the user's chosen action.
- [ ] `CHANGELOG.md` gains an entry under the next release noting:
  - The new `conflict` CLI subcommand group.
  - The tightened `kb-curate` skill permissions (no more `Edit` / `Write` / `Bash(rm:*)`).
  - That existing installations should run `ai-knowledge-base init --upgrade` to pick up the new skill template.
- [ ] No reference to "Supersede" or "Keep both" actions appears anywhere in the docs; only `Replace` and `Reject` are documented.
- [ ] No `docs/` directory file is created if one does not already exist (only the README and CHANGELOG are in scope).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `README.md` (root). Locate the existing command reference section by searching for `curate` and `status`; insert the new entries in the same style.
- File: `CHANGELOG.md` (root). Append under the unreleased / next-version section using the project's existing changelog style. The repo uses Conventional Commits (see `.ai/task-manager/plans/12--swap-handrolled-helpers-for-libraries/...` and similar) so a `feat:`-style line is appropriate if the changelog groups by commit type.

## Input Dependencies

- Tasks 1–3 establish the new CLI surface and skill permissions being documented; this task only describes what they already do.

## Output Artifacts

- Updated `README.md`.
- Updated `CHANGELOG.md`.

## Implementation Notes

<details>
<summary>Wording guidance</summary>

For the README, keep it factual and short, mirroring the project's existing terse command descriptions. For example:

> - `ai-knowledge-base conflict list` — print pending conflicts from `.ai/knowledge-base/.state/pending-conflicts.json` as JSON.
> - `ai-knowledge-base conflict resolve <id> --action <replace|reject>` — apply the user's decision for a single conflict. `replace` overwrites the existing node with the proposed one and rewrites the state file; `reject` drops the proposal. Either way, `INDEX.md` and `GRAPH.md` are regenerated.

For the changelog, a single bullet covering both halves of the change is sufficient. Example shape:

> - feat(cli): add `conflict list` / `conflict resolve <id> --action <replace|reject>` subcommands so the kb-curate skill no longer needs `Edit`, `Write`, or `Bash(rm:*)` permissions. Existing installations: run `ai-knowledge-base init --upgrade` to pick up the new skill template.

Do not invent docs that the plan does not require: no migration guide, no design-doc page, no diagrams in the README. The plan's "Documentation" section explicitly limits this to README + CHANGELOG (plus the SKILL.md rewrite, which is Task 3).

</details>
