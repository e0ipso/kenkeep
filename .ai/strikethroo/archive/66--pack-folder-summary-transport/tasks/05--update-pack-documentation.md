---
id: 5
group: "pack-transport"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-08-05
skills:
  - markdown
  - technical-writing
complexity_score: 3
execution_profile: "docs-and-config"
---
# Correct the pack documentation for the summary transport

## Objective

Document the folder summary transport and delete the stale claim that folder `index.md` summaries survive the import rebuild — a statement that was true under schema version 2 and has been false since the v3 migration.

## Skills Required

- **markdown** — editing the project's Markdown documentation.
- **technical-writing** — describing the transport, re-keying, and backwards-compatibility behavior accurately.

## Acceptance Criteria

- [ ] `docs/knowledge-packs.md`: the pack layout diagram (around lines 98-133) includes `knowledge.FOLDER_SUMMARIES.md` at the pack root, beside `kenkeep-pack.yaml`.
- [ ] `docs/knowledge-packs.md`: the false claim at lines 132-133 that folder `index.md` summaries survive the import rebuild is **deleted**, replaced by an accurate description of the registry transport, the re-keying rule under the destination branch, `--as` behavior, and the fact that a pack without a registry still imports with a warning.
- [ ] `docs/internals/schemas.md`: the folder summary registry section (around lines 173-182) notes that the same schema and serialization are reused for the pack-root registry, and that pack registries are validated at import.
- [ ] `docs/internals/architecture.md`: the "missing summary is warn, never block" statement at line 135 is verified to still read correctly given the new export-time and import-time warnings; adjust it only if it implies the index rebuild is the sole source of that warning.
- [ ] No production source file is modified by this task.
- [ ] Runnable verification: `grep -n "survive the import rebuild" docs/knowledge-packs.md` from `/workspace` prints nothing.
- [ ] Runnable verification: `grep -n "knowledge.FOLDER_SUMMARIES.md" docs/knowledge-packs.md docs/internals/schemas.md` prints at least one match in each file.
- [ ] Runnable verification: `npm run lint` (or the repo's configured Markdown lint task, if separate) exits `0`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Edit only files under `docs/`.
- Match the surrounding documentation's voice, heading depth, and code-fence conventions.
- Describe behavior as implemented by tasks 1-3; read those source files rather than restating this task's prose.

## Input Dependencies

- Tasks 1, 2, and 3 — the documentation describes their final behavior, so it must be written against the implemented code, not against the plan.

## Output Artifacts

- Accurate pack documentation with no stale v2 claims.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Read the implementation first.** Before writing, read the final state of `src/commands/pack-export.ts`, `src/lib/pack.ts`, and `src/commands/pack-import.ts` so the documentation matches what shipped. Line numbers cited below are from before the change and may have shifted — locate the content by its text, not by line number.

**`docs/knowledge-packs.md`.**

- Find the pack layout diagram around lines 98-133 and add `knowledge.FOLDER_SUMMARIES.md` as a pack-root entry, a sibling of `kenkeep-pack.yaml` and `README.md`.
- Delete the sentence at lines 132-133 stating that folder `index.md` summaries survive the import rebuild so pack authors can describe branches before publishing. It described v2 behavior, where summaries lived in `nodes/**/index.md` frontmatter and rode along inside the copied tree. Under v3 they live in a sidecar and the claim is simply false.
- Replace it with prose covering: the registry ships at the pack root; import re-keys each entry under the destination branch, so a pack's `apis` becomes `<branch>/apis` in the consumer; `--as <name>` re-keys under the renamed branch; `manifest.summary` remains authoritative for the branch root key; and a pack published without a registry still imports successfully, warning that folders have no summary.

**`docs/internals/schemas.md`.** In the folder summary registry section around lines 173-182, note that the pack-root registry uses the same `FolderSummaryRegistrySchema` and the same serialization, and that a pack-shipped registry is validated at import: schema failures and keys escaping the knowledge tree are errors, while folders with no entry are warnings.

**`docs/internals/architecture.md`.** Read line 135 in context. It states the "missing summary is warn, never block" contract. If it reads as a general contract, leave it alone. Only if it attributes that warning solely to the index rebuild should you broaden it to mention pack export and pack import as additional sources. Do not rewrite the surrounding section.

**Explicitly out of scope.**

- Do not modify `AGENTS.md`. This change alters pack command behavior, not the agent-facing knowledge-base contract or the authoring workflow.
- Do not modify any file under `src/` or `tests/`.
- Do not document a v2-pack migration path — v2 packs remaining unimportable is a separate concern with its own issue.
- Do not document a pack-format version field; none exists, and none is being added.

</details>
