---
id: 5
group: "cursor-adapter"
dependencies: [2]
status: "completed"
created: "2026-05-21"
skills:
  - typescript
  - node
---
# Implement Cursor headless runner via agent -p

## Objective

`src/harnesses/cursor/headless.ts` spawns the Cursor CLI (`agent -p` / `--print`) with `--output-format json`, sets `KB_BUILDER_INTERNAL=1`, parses the structured CLI output into text, and validates against a caller-supplied Zod schema. Wire `cursorAdapter.runHeadless` and extend doctor to probe `agent` then `cursor agent`.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `runHeadlessCursor(prompt, stdin, schema, opts)` spawns `agent` (or `harnessOpts.agentCli` override) with `-p`, prompt, `--output-format json`, optional model flag from `CursorHarnessOpts`
- [ ] Child env includes `KB_BUILDER_INTERNAL=1`
- [ ] Honors `timeoutMs`, `logFile`, `onMessage` consistent with Codex/Claude headless runners
- [ ] Parses JSON stream or final JSON payload; validates with `opts.schema`; descriptive error on parse/validation failure
- [ ] `cursorAdapter.runHeadless` delegates here (replaces Task 2 placeholder)
- [ ] `doctor.ts` checks: `agent --version` first, fallback `cursor agent --version`; error when neither found
- [ ] Unit test uses a fake `agent` shim emitting documented JSON output; runner returns Zod-validated curator-shaped object
- [ ] `npm run build` and `npm test` pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/cursor/headless.ts`
- `src/harnesses/cursor/index.ts`, `doctor.ts`
- Codex/OpenCode headless modules as reference
- [CLI output format](https://cursor.com/docs/cli/reference/output-format) docs for fixture shape

## Input Dependencies

- Task 2 (adapter scaffold, opts schema)

## Output Artifacts

- Headless `curate` / `bootstrap` / proposal paths work with `--harness cursor`

## Implementation Notes

<details>
<summary>Guidance</summary>

- Pin output-format expectations in a comment or later KB node; adapter owns parser drift handling.
- CI does not require real `agent` on PATH; tests mock/spawn shim only.
- No new npm dependencies unless execa pattern already covers spawn needs.

</details>
