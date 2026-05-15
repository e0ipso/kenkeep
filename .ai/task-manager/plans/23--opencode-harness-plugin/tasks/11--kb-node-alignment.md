---
id: 11
group: "documentation"
dependencies: [3, 4, 8]
status: "completed"
created: 2026-05-15
skills:
  - technical-writing
---

# Align knowledge-base nodes and regenerate INDEX.md/GRAPH.md

## Objective

Update the project's own knowledge base under `nodes/` so it reflects: (a) the new detect-harness recipe for the explicit-flag rule, (b) the OpenCode adapter as a registered component, (c) the shared-skill-templates convention. Regenerate INDEX.md and GRAPH.md via `index rebuild`.

## Skills Required

- technical-writing

## Acceptance Criteria

- [ ] `nodes/practice/practice-explicit-harness-flag.md` body rewritten. The rule is unchanged ("every CLI invocation passes `--harness <id>` explicitly"). The body now describes the mechanism: skills materialize `/tmp/kb-detect-harness.mjs` from a heredoc, run it to resolve the active id, and pass it as `--harness "$HARNESS"`. The hint-wins-when-explicit priority order is documented
- [ ] `nodes/map/map-opencode-harness-adapter.md` is created describing: adapter id, native layout (`.opencode/plugins/kb.mjs`, `.opencode/kb-hooks/`, `.opencode/skills/`), event vocabulary (`session.idle`, `session.created`), `detectFromEnv` not implemented (selection via `--hint` or `cliDefaultHarness`), disk-parse-with-export-fallback transcript strategy
- [ ] `nodes/practice/practice-shared-skill-templates.md` is created. Documents: single SKILL.md source per skill at `src/templates-source/skills/`; identical bytes installed to every configured harness's `skillsDir`; detect-harness heredoc resolves `--harness` at runtime; CI lint guards drift with `src/harnesses/detect.ts`
- [ ] All three nodes use the existing frontmatter schema (see `nodes/map/map-node-frontmatter.md`) with appropriate `kind`, `name`, `description`, `tags` fields
- [ ] Existing nodes that referenced "Claude and Codex" lists are updated to include OpenCode where appropriate (audit at minimum: `nodes/practice/practice-explicit-harness-flag.md`, `nodes/map/map-claude-hooks.md`, `nodes/map/map-codex-harness-adapter.md`, any others surfaced by `grep -l "claude.*codex"` under `nodes/`)
- [ ] `INDEX.md` and `GRAPH.md` regenerated via `npx @e0ipso/ai-knowledge-base index rebuild` (or `node dist/cli.js index rebuild` if the package is not yet published); diffs reflect the three new/updated nodes
- [ ] No node uses em-dashes, en-dashes, or ` - ` as a separator (per `feedback_no_em_dashes`)
- [ ] No node uses retrospective framing such as "earlier versions" or "previously" (per `feedback_no_retrospective_framing`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `nodes/practice/practice-explicit-harness-flag.md`
- `nodes/map/map-opencode-harness-adapter.md`
- `nodes/practice/practice-shared-skill-templates.md`
- Other nodes surfaced by the Claude+Codex audit
- `INDEX.md`, `GRAPH.md` regenerated

## Input Dependencies

- Task 3 (resolveWithHint priority chain to document accurately)
- Task 4 (OpenCode adapter exists)
- Task 8 (shared skill tree exists and the recipe is finalized)

## Output Artifacts

- Three KB nodes (one rewritten, two new)
- Regenerated INDEX.md and GRAPH.md

## Implementation Notes

<details>
<summary>Guidance</summary>

- Cross-link the new and updated nodes with `[[wiki-style]]` references following the existing convention. The new `map-opencode-harness-adapter` should link to `[[practice-explicit-harness-flag]]` and `[[practice-shared-skill-templates]]`; the new `practice-shared-skill-templates` should link to `[[map-opencode-harness-adapter]]`, `[[map-codex-harness-adapter]]`, `[[map-claude-skills]]`, and `[[practice-explicit-harness-flag]]`.
- For the rewritten `practice-explicit-harness-flag`: keep the rule sentence as the lead; add a "Mechanism" subsection describing the heredoc + `/tmp/kb-detect-harness.mjs` script; add a "Priority" subsection documenting the hint-wins-when-explicit chain from `resolveWithHint`.
- Use `node dist/cli.js index rebuild` if working in the package's own repo without a published version available via `npx`. The deterministic rebuild rule (per existing `practice-deterministic-index-graph-regeneration`) means the output is reproducible from the nodes/ content.
- Verify by `git diff INDEX.md GRAPH.md` showing only the expected additions/edits.

</details>
