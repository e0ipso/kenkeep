---
id: 6
group: "documentation"
dependencies: [2, 4, 5]
status: "completed"
created: 2026-06-08
skills:
  - technical-writing
---
# Update human- and AI-facing docs for folder summaries and the actionable index format

## Objective
Document the finalized behavior: the summary authoring-vs-carrying-vs-rendering
separation, the new ENTRY/index format (imperative Load/Open pointers, embedded
directive, breadcrumb, no statistics), the reworked `## By topic` semantics, the
self-preserved-and-authored-by-migrate/rebalance contract, and the folder-summary
phrasing contract in the clustering prompts.

## Skills Required
- `technical-writing`: edit the prose docs to match the shipped behavior precisely, without overstating or contradicting the code.

## Acceptance Criteria
- [ ] `AGENTS.md`: the ENTRY/index format description, the navigation/descent guidance, and the statement that folder summaries are self-preserved and authored by migrate/rebalance are updated.
- [ ] `docs/how-it-works.md` and `docs/internals/architecture.md`: the summary authoring vs carrying vs rendering separation, and the reworked `## By topic` (per-tag, ≤3, whole-tree Jaccard, path+summary) semantics are documented.
- [ ] `docs/internals/prompts.md`: records that the migrate and rebalance clustering prompts now author a folder `summary`, including the phrasing contract.
- [ ] `README.md` (and any template README) plus the `KK_NAVIGATION_DIRECTIVE` constant comment are updated as needed to reflect the embedded directive and the no-statistics body.
- [ ] No doc claims a schema version bump (there is none — v2 absorbs the field). No doc references removed statistic lines as present.
- [ ] The kk-curate SKILL.md op-plan examples are NOT re-edited here (Task 5 owns them); this task only cross-references them where appropriate.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files to edit: `AGENTS.md`, `docs/how-it-works.md`, `docs/internals/architecture.md`, `docs/internals/prompts.md`, `README.md`, and the `KK_NAVIGATION_DIRECTIVE` doc-comment in `src/lib/session-start.ts` if its description drifts from the embedded-in-body reality.
- The prose must match the behavior implemented in Tasks 2, 4, and 5 exactly; read those final implementations before writing.

## Input Dependencies
- Task 2: the final rendered format and By-topic semantics.
- Task 4: the migrate summary-authoring prompt/phrasing contract.
- Task 5: the rebalance summary-authoring prompt/phrasing contract.

## Output Artifacts
- Updated documentation set that matches the shipped feature (plan "Documentation" section satisfied).

## Implementation Notes
Documentation only — no code behavior changes. Accuracy over volume; describe
what the code does, not what it might do.

<details>
<summary>Detailed implementation guidance</summary>

1. Read the final state of `src/lib/index-gen.ts`, `src/lib/session-start.ts`,
   `src/commands/migrate.ts`, and `src/lib/rebalance-move.ts` (post Tasks 2/4/5)
   so the prose matches reality.

2. **AGENTS.md.** Find the section describing ENTRY.md/index.md format and
   navigation. Replace any description of statistic lines / passive bullets with:
   imperative `Load [\`name/\`](…) for more information on <summary>` descent
   pointers, `Open [**title**](…) to learn about: <summary>` leaf pointers, the
   embedded descent directive, the `↑ Parent` breadcrumb on non-root indexes, and
   no body statistics. State that each folder carries a self-preserved `summary`
   in its `index.md` frontmatter, authored only by the v1→v2 migrate and the
   rebalance clustering steps (humans may hand-edit), and carried verbatim by
   every deterministic rebuild.

3. **docs/how-it-works.md & docs/internals/architecture.md.** Document the
   three-way separation: authoring (semantic, LLM, rare — migrate + rebalance),
   carrying (deterministic, every rebuild — `generateIndex` self-preserve),
   rendering (deterministic). Document the reworked `## By topic`: per tag present
   among a folder's direct leaves, the ≤3 most-central whole-tree nodes by tag
   Jaccard (`|A∩B|/|A∪B|`), tie-broken by in-degree then title, rendered as
   followable path+summary entries; and note the per-folder-hash exclusion of that
   cross-tree block.

4. **docs/internals/prompts.md.** Add that the migrate clustering prompt and the
   rebalance clustering prompt each now emit a one-line folder `summary`, and
   record the phrasing contract: the summary must read as a fragment completing
   `for more information on …` / `to learn about: …` (lowercase start, no trailing
   period, concise).

5. **README.md / template README / directive comment.** Reflect the embedded
   directive and the leaner, statistic-free always-on payload where these files
   describe the entry catalog. Update the `KK_NAVIGATION_DIRECTIVE` doc-comment
   only if it now misdescribes where the directive appears (it is embedded in
   generated bodies AND injected once at SessionStart).

6. Do not edit the kk-curate SKILL.md op-plan JSON (Task 5 owns it); you may link
   to it.
</details>
