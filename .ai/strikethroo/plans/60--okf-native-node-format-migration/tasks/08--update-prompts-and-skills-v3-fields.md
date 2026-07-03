---
id: 8
group: "prompts-docs"
dependencies: [1]
status: "pending"
created: 2026-07-02
skills:
  - prompt-engineering
  - markdown
complexity_score: 4
complexity_notes: "Mechanical but wide: every prompt that drafts node frontmatter and each kk-* skill reference must emit v3 names, each prompt carrying its Version bump."
---
# Update prompt templates and kk-* skills to emit v3 node fields

## Objective
Update every LLM-facing prompt template that instructs a model to draft node
frontmatter, and the kk-* skill references, to emit the v3 field names (`type`,
`title`, `description`, `tags`, `kk_*`), bumping each touched prompt's `<!-- Version -->`
comment per the established practice, so drafted output validates against the v3
schema.

## Skills Required
- **prompt-engineering** — rewrite the node-drafting instructions accurately.
- **markdown** — edit the template and skill source files.

## Acceptance Criteria
- [ ] Every prompt template under `src/templates-source/` that describes node frontmatter uses `type`/`description`/`kk_*` and no longer references `kind`/`summary`/unprefixed `schema_version`.
- [ ] Each touched prompt template's `<!-- Version -->` comment is bumped.
- [ ] kk-* skill source files (`templates/skills/kk-*`, excluding kk-migrate which task 6 owns) that name node field names are updated to v3.
- [ ] Verification: `grep -rIl -e '\bkind:' -e '\bsummary:' src/templates-source templates/skills` returns no prompt/skill that still drafts v2 node frontmatter; and a drafted sample validated with `npx kenkeep validate` passes against the v3 schema. Expected: no stale matches, validate exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: prompt templates under `src/templates-source/`; kk-* SKILL/prompt
  sources under `templates/skills/`.
- Do not touch kk-migrate SKILL.md here (task 6 owns it).

## Input Dependencies
- Task 1: the v3 field contract the prompts must match.

## Output Artifacts
- v3-emitting prompts/skills that keep drafted node output schema-valid.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. `grep -rIn -e 'kind' -e 'summary' -e 'schema_version' src/templates-source
   templates/skills` to enumerate every prompt/skill that describes node
   frontmatter.
2. For each, rename the described fields to v3: `type` (values practice|map),
   `title`, `description` (≤140 chars), `tags`, and the `kk_`-prefixed
   `kk_id`/`kk_relates_to`/`kk_depends_on`/`kk_derived_from`/`kk_confidence`/
   `kk_schema_version`.
3. Bump the `<!-- Version -->` comment in each touched prompt template.
4. Skip `templates/skills/kk-migrate/SKILL.md` (owned by task 6).
5. Rebuild any generated harness copies if the build materializes them, then run
   `npx kenkeep validate` on a drafted sample to confirm v3 conformance.
</details>
