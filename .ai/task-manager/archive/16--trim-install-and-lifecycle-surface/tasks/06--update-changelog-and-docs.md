---
id: 6
group: "documentation"
dependencies: [2, 3, 4, 5]
status: "completed"
created: 2026-05-13
skills:
  - technical-writing
---
# Update CHANGELOG and external docs

## Objective

Land a single CHANGELOG entry covering the four removals; update `README.md` and `AGENTS.md` to drop references to `--dry-run`, the husky/secretlint auto-setup, and the `pending-conflicts.json` workflow, and add a short "run secretlint in CI" note. Sweep `.ai/knowledge-base/nodes/` for the same stale names and update or delete affected nodes.

## Skills Required

- `technical-writing`: concise, accurate edits matching the project's conventional-commits / semantic-release flow and the no-retrospective-framing rule.

## Acceptance Criteria

- [ ] `CHANGELOG.md` has one entry under the next version describing the four removals and explicitly listing the breaking pieces: `--dry-run` removed; `pending-conflicts.json` no longer written or read; `init` no longer adds husky/secretlint/`prepare: husky` to consumer `package.json`; `init` no longer requires `package.json` to exist.
- [ ] `README.md` contains no mention of `init --dry-run` or the commit-time secret-scan auto-setup; it contains a short paragraph or snippet documenting "run secretlint in CI" as the recommended pattern.
- [ ] `AGENTS.md` references the markdown-files conflict flow (not `pending-conflicts.json`); references to husky scaffolding are removed.
- [ ] `.ai/knowledge-base/nodes/` contains no stale references to `pending-conflicts.json`, `--dry-run`, or the husky/secretlint auto-setup; affected nodes have been updated or deleted.
- [ ] `grep -rn "pending-conflicts\.json\|--dry-run\|installCommitScan\|UpgradeChange" README.md AGENTS.md .ai/knowledge-base/nodes/ CHANGELOG.md` returns hits only inside the new CHANGELOG entry (which documents removal).

## Technical Requirements

- Markdown edits across `CHANGELOG.md`, `README.md`, `AGENTS.md`, and selected KB nodes.
- Follow project conventions: conventional-commits-style CHANGELOG entry; no em-dashes or hyphen-as-dash as separators (use commas, colons, or parentheses).

## Input Dependencies

- Task 2: upgrade preflight + `--dry-run` removed.
- Task 3: husky/secretlint scaffolding removed.
- Task 4: `pending-conflicts.json` replaced with markdown files.
- Task 5: doctor trimmed.

## Output Artifacts

- Updated `CHANGELOG.md` with one new entry.
- Updated `README.md`.
- Updated `AGENTS.md`.
- Updated or deleted KB nodes under `.ai/knowledge-base/nodes/`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `CHANGELOG.md`: add one entry at the top under the next version section. Group the four removals as bullets. Tag the breaking pieces clearly. Keep the entry tight (it is a release note, not an explainer). Do not narrate "previously X, now Y" history outside the changelog format the project already uses; mirror the structure of recent entries.
2. `README.md`:
   - Grep for `--dry-run` and remove every mention.
   - Locate the commit-time secret-scan section (auto-setup of husky/secretlint) and replace it with one short paragraph: recommend running `secretlint` in CI, optionally include a minimal GitHub Actions snippet. Do not write retrospective framing.
   - Re-read the surrounding sections to confirm flow.
3. `AGENTS.md`:
   - Grep for `pending-conflicts.json` and replace each mention with the markdown-files flow under `.ai/knowledge-base/conflicts/`.
   - Grep for husky / `.secretlintrc` / `.lintstagedrc` and remove.
4. KB nodes:
   - `grep -rn "pending-conflicts\.json\|--dry-run\|installCommitScan\|husky\|secretlint" .ai/knowledge-base/nodes/`
   - For each hit, either update the node to reflect the current design or delete the node if its sole purpose was to document the removed feature.
   - If a node is updated, refresh its frontmatter timestamps per the KB conventions.
5. Final grep check (per acceptance criteria) to confirm no stale references remain outside the new CHANGELOG entry.

</details>
