---
id: 7
group: "documentation"
dependencies: [6]
status: "completed"
created: "2026-05-21"
skills:
  - technical-writing
---
# Align project docs and KB nodes for Cursor harness

## Objective

Update user-facing documentation and curated KB nodes so Cursor is a fourth supported harness: install layout, env detection, third-party Claude hooks caveat, `agent -p` prerequisite, and new map node. Regenerate INDEX.md and GRAPH.md.

## Skills Required

- technical-writing

## Acceptance Criteria

- [ ] `PRD.md` lists Cursor in supported harnesses; documents capture triggers `stop`, `sessionEnd`, `preCompact`
- [ ] `README.md` includes Cursor paragraph and `init --harnesses cursor`
- [ ] `docs/installation.md` adds Cursor section: `.cursor/` layout, `agent` CLI, `transcript_path` / `CURSOR_TRANSCRIPT_PATH`, third-party `.claude/settings.json` bridge insufficient alone, double-hook warning, `cliDefaultHarness` for plain shell
- [ ] `docs/cli-reference.md` and `docs/how-it-works.md` mention `--harness cursor` and Cursor capture triggers
- [ ] `CONTRIBUTING.md` cites Cursor alongside Codex as shell-hook adapter reference
- [ ] New `.ai/knowledge-base/nodes/map/map-cursor-harness-adapter.md` (id `map-cursor-harness-adapter`, kind `map`) documents paths, events, headless binary, transcript source, env detection
- [ ] Update `map-harness-adapter.md` summary and `practice-explicit-harness-flag-outside-claude.md` to mention Cursor
- [ ] `node dist/cli.js index rebuild` (or project INDEX generator) succeeds; INDEX.md and GRAPH.md updated deterministically
- [ ] If `sessionStart` `additional_context` injection is unreliable in self-validation, document AGENTS.md INDEX fallback in `docs/installation.md` only (no new AGENTS.md unless required)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `PRD.md`, `README.md`, `docs/installation.md`, `docs/cli-reference.md`, `docs/how-it-works.md`, `CONTRIBUTING.md`
- `.ai/knowledge-base/nodes/map/map-cursor-harness-adapter.md`
- `.ai/knowledge-base/INDEX.md`, `GRAPH.md`
- Optional: `docs/internals/architecture.md` if harness list is enumerated there

## Input Dependencies

- Task 6 (implementation complete; docs reflect actual behavior)

## Output Artifacts

- Discoverable Cursor harness documentation and KB map node

## Implementation Notes

<details>
<summary>Guidance</summary>

- Follow [practice-determinism-contract](.ai/knowledge-base/nodes/practice/practice-determinism-contract.md) for INDEX/GRAPH regeneration.
- Node naming: `map-cursor-harness-adapter.md` under `nodes/map/`, frontmatter `schema_version: 1`.
- Link official Cursor docs: Hooks, Third Party Hooks, CLI using, Skills (URLs in plan).
- Migration note: users on Claude-in-Cursor via third-party skills should remove KB hooks from `.claude/settings.json` when switching to `init --harnesses cursor`.
- Do not expand `init` to install husky/secretlint (constitution).

</details>
