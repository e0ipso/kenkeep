---
id: 7
group: "documentation"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - technical-writing
---
# Rewrite user docs, IMPLEMENTATION.md, and KB template files for the slim schema

## Objective

Update every user-facing doc and shipped template so it describes a flat, current-only KB with a binary replace/reject conflict model and no temporal/lineage frontmatter. The rewrite preserves the existing structure where possible; sections that exist only to describe supersession are deleted, and sections that mention the removed fields are reframed to describe only what remains. No retrospective framing; no em-dash / hyphen-as-dash separators.

## Skills Required

- technical-writing: rewrite published documentation under strict style rules (no em-dashes or hyphen-as-dash separators, no retrospective framing) while preserving overall doc structure.

## Acceptance Criteria

- [ ] `docs/how-it-works.md` graph-edges paragraph lists only `relates_to`, `depends_on`, `derived_from`; no mention of `supersedes` / `superseded_by`.
- [ ] `docs/internals/schemas.md` node-frontmatter example, field-rationale list, and conflict-resolution table reflect the slim schema and binary replace/reject menu.
- [ ] `docs/daily-use.md` contradiction-resolution sentence mentions replace and reject only.
- [ ] `docs/troubleshooting.md` contradiction-resolution sentence mentions replace and reject only.
- [ ] `IMPLEMENTATION.md` §4.1 (Node frontmatter), §6.6 (Contradiction handling), §6.8 (no "Superseded nodes stay in place"), §8 (INDEX algorithm and header line), §11.5 (no "Validity windows over deletion" decision) reflect the new design.
- [ ] `src/templates-source/knowledge-base/README.md` no longer documents `valid_from`, `valid_until`, `superseded_by`, `supersedes` bullets.
- [ ] `src/templates-source/knowledge-base/INDEX.md` (the seed shipped with `init`) header reads `_0 nodes • ~0 estimated tokens_`.
- [ ] `.ai/knowledge-base/README.md` (the installed copy of the README template) is regenerated from the source template or hand-edited to match.
- [ ] `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md` body describes INDEX/GRAPH shape per the new generators (header line, no `Recently superseded`, no per-node `status:`/`supersedes:`/`superseded_by:` lines). (Frontmatter trim of this file is done by task 5; this task handles body.)
- [ ] No retrospective framing ("previously", "we used to", "the old shape included") appears anywhere outside `CHANGELOG.md` (if a CHANGELOG entry is added; otherwise no retrospective framing anywhere).
- [ ] No em-dash (`—`), en-dash (`–`), or ` - ` separator appears in any edited prose.
- [ ] A repo-wide grep across the listed files for `valid_from|valid_until|superseded_by|supersedes|Recently superseded|archival` returns empty (CHANGELOG excluded if it is created).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files:
  - `docs/how-it-works.md`
  - `docs/internals/schemas.md`
  - `docs/daily-use.md`
  - `docs/troubleshooting.md`
  - `IMPLEMENTATION.md`
  - `src/templates-source/knowledge-base/README.md`
  - `src/templates-source/knowledge-base/INDEX.md`
  - `.ai/knowledge-base/README.md`
  - `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md` (body only)
- Coordination: task 5 handles the frontmatter trim for `map-index-and-graph-files.md` and the body trim for `practice-determinism-contract.md`. This task handles the body of `map-index-and-graph-files.md`. Do not double-edit.

## Input Dependencies

- Task 1 completed (the documented schema must match the code schema).

## Output Artifacts

- All listed doc and template files updated.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **`docs/how-it-works.md`**: locate the paragraph that enumerates graph-edge types. The sentence likely reads roughly "edges include relates_to, depends_on, derived_from, supersedes, and superseded_by". Rewrite as a comma-separated list of `relates_to`, `depends_on`, `derived_from` only. If a sentence explained the temporal/versioning semantics of the supersession edges, delete that sentence entirely.

2. **`docs/internals/schemas.md`**:
   - Replace the node-frontmatter YAML example with the slim shape.
   - Rewrite the field-rationale list (one bullet per surviving field). Delete bullets for the five removed fields.
   - Rewrite the conflict-resolution table to two rows (Replace, Reject) with columns describing the resulting on-disk state and any side effects (file deletion for Replace, nothing for Reject).

3. **`docs/daily-use.md`**: find the paragraph that walks a user through resolving a curator contradiction. Rewrite the resolution-options sentence as: the user picks Replace (delete the old node file, write the new one) or Reject (do nothing). Remove any mention of `supersedes` or `valid_until`.

4. **`docs/troubleshooting.md`**: same edit pattern as `daily-use.md`; check for any FAQ entry about "what does `superseded_by` mean" and delete that entry.

5. **`IMPLEMENTATION.md`**:
   - **§4.1 (Node frontmatter)**: rewrite the field list to the slim shape. Re-state explicitly that git history is the timeline of record. Do not add a "removed fields" subsection.
   - **§6.6 (Contradiction handling)**: rewrite to describe the binary replace/reject model. The curator emits `contradict`; the user later picks Replace or Reject. Replace deletes the old node file; Reject does nothing.
   - **§6.8**: delete the bullet or paragraph "Superseded nodes stay in place" entirely.
   - **§8 (INDEX algorithm and header line)**: update the header line example to `_N nodes • ~T estimated tokens_`. Update the algorithm description to describe a single-pass render with no partition step.
   - **§11.5**: delete the "Validity windows over deletion" design-decision entry. If the surrounding numbering matters, renumber subsequent entries; otherwise leave the slot empty. Do not replace it with a "we decided to delete instead" entry — that is retrospective framing. If a decision entry is wanted, title it "Replacement deletes the old node" and state the rule in present tense.

6. **`src/templates-source/knowledge-base/README.md`**: this is the README shipped to user projects by `init`. Drop the bullets describing `valid_from`, `valid_until`, `supersedes`, `superseded_by`. Update any walkthrough that references the supersession menu.

7. **`src/templates-source/knowledge-base/INDEX.md`**: the seed INDEX file shipped to new projects. Change the header line to `_0 nodes • ~0 estimated tokens_`.

8. **`.ai/knowledge-base/README.md`**: the installed copy of the README. After editing the source template, copy the new content into this file so they match. If the project uses a build step to materialize the template, run that step instead.

9. **`.ai/knowledge-base/nodes/map/map-index-and-graph-files.md` body**: rewrite the description of INDEX/GRAPH shape so it reflects:
   - INDEX header: `_N nodes • ~T estimated tokens_`.
   - INDEX body: one section per kind; no `## Recently superseded`.
   - GRAPH per-node block: no `status:`, no `supersedes:`, no `superseded_by:` lines.
   Do not modify frontmatter (task 5 handles that).

10. **Style sweep**. On every file you touched:
    ```
    grep -nE "( - |—|–)" <file>
    ```
    Replace narrative-prose hits with commas, colons, or parentheses. YAML examples and fenced code blocks are exempt.

11. **Retrospective-framing sweep**. On every file you touched:
    ```
    grep -nE "previously|used to|earlier this|legacy" <file>
    ```
    Rewrite any narrative-prose hit in present tense. (CHANGELOG.md, if you choose to add an entry, is the only place these phrasings are appropriate; this task does not require a CHANGELOG entry but does not forbid one.)

12. **Final verification grep across edited files only:**
    ```
    grep -nE "valid_from|valid_until|superseded_by|supersedes|Recently superseded|archival" \
      docs/how-it-works.md docs/internals/schemas.md docs/daily-use.md docs/troubleshooting.md \
      IMPLEMENTATION.md src/templates-source/knowledge-base/README.md \
      src/templates-source/knowledge-base/INDEX.md .ai/knowledge-base/README.md \
      .ai/knowledge-base/nodes/map/map-index-and-graph-files.md
    ```
    Expect zero hits.

</details>
