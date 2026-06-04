---
id: 7
group: "documentation"
dependencies: [2, 3, 4, 5]
status: "completed"
created: 2026-05-15
skills:
  - technical-writing
---

# Add map-copilot-harness-adapter KB node and update map-adapter-interface

## Objective

Add a new map node documenting the Copilot adapter surface (per-event JSON hook file, events.jsonl transcript source, `.github/skills/` install location, absence of `detectFromEnv`, sentinel-block strategy). Update the existing `map-adapter-interface` node to reflect `HookSpec.payload`. Regenerate INDEX.md and GRAPH.md.

## Skills Required

- technical-writing

## Acceptance Criteria

- [ ] `.ai/knowledge-base/nodes/map/map-copilot-harness-adapter.md` exists with the standard map-node frontmatter (`kind: map`, `tags`, etc., mirroring `map-codex-harness-adapter.md` and `map-opencode-harness-adapter.md` for shape) and covers: (1) the `~/.copilot/hooks/kb.json` user-level file and the `.copilot/hooks/kb.json` project documentation artifact, (2) the `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl` transcript source, (3) the `.github/skills/` install location, (4) the absence of `detectFromEnv` (selection via `--harness` / `--hint` / `cliDefaultHarness`), (5) the `.github/copilot-instructions.md` sentinel block strategy for session-start context injection, (6) the headless invocation argv (`copilot -p ... --no-ask-user --allow-all-tools --add-dir <root>`)
- [ ] `.ai/knowledge-base/nodes/map/map-adapter-interface.md` updated so the `HookSpec` definition includes `payload?: Record<string, unknown>` with one-sentence explanation: "opaque per-adapter blob consumed only by that adapter's hooks-config writer"
- [ ] Cross-references added: the new Copilot map node links to `map-adapter-interface` and to the sibling Codex / OpenCode map nodes; the updated `map-adapter-interface` links to the new Copilot map node
- [ ] `npx @e0ipso/ai-knowledge-base index rebuild` runs cleanly (zero errors) and updates `INDEX.md` and `GRAPH.md` to include the new node
- [ ] `INDEX.md` lists the new Copilot map node under the appropriate section
- [ ] Per `feedback_no_em_dashes`: no `—`, `–`, ` - ` separators in the new node prose; use commas, colons, or parentheses
- [ ] Per `feedback_no_retrospective_framing`: describe the current design only

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `.ai/knowledge-base/nodes/map/map-copilot-harness-adapter.md` (new)
- `.ai/knowledge-base/nodes/map/map-adapter-interface.md` (update)
- `INDEX.md`, `GRAPH.md` (regenerated)

## Input Dependencies

- Task 2 (adapter scaffold; the map node documents the adapter's surface)
- Task 3 (hooks-config + sentinel writer; documented in the node)
- Task 4 (transcript parser; documented in the node)
- Task 5 (headless runner; documented in the node)

## Output Artifacts

- New `map-copilot-harness-adapter` node, updated `map-adapter-interface`, regenerated INDEX.md and GRAPH.md

## Implementation Notes

<details>
<summary>Guidance</summary>

- Use `map-opencode-harness-adapter.md` as the closest structural template (per-event names list, paths summary, headless flags table). Adapt to Copilot specifics (no in-session env var, sentinel block, etc.).
- For frontmatter `tags`, mirror the sibling map nodes' conventions (e.g. `harness`, `adapter`, `copilot`).
- For the cross-references, use the markdown link syntax already in use in sibling map nodes (e.g. `[map-adapter-interface](./map-adapter-interface.md)`).
- After editing, run `npx @e0ipso/ai-knowledge-base index rebuild` from the repo root. Verify the resulting `INDEX.md` and `GRAPH.md` diffs are scoped to the new entries.
- Per the KB convention (Plan 22 and 23): each registered harness has a map node. Failing to add it is a doc-drift signal.

</details>
