---
id: 2
group: "usage-extraction"
dependencies: [1]
status: "completed"
created: 2026-06-20
skills:
  - typescript
  - harness-adapters
complexity_score: 6
complexity_notes: "Touches all supported harness transcript/export extractors and must preserve transcript-order interleaving across read and command-derived candidates."
---
# Wire Shell Search Extraction Across Harnesses

## Objective
Extend each supported harness extractor to collect command-string or explicit path-bearing candidates from visible shell/search tool shapes while preserving existing dedicated read-tool behavior.

## Skills Required
Requires `typescript` and `harness-adapters` skills to apply one cross-harness usage feature without assuming a single transcript shape.

## Acceptance Criteria
- [ ] Claude Code extraction includes candidates from `Bash` tool-use `input.command` values.
- [ ] Codex extraction includes candidates from shell-style rollout function calls that expose a command string in parsed arguments.
- [ ] Cursor extraction includes candidates from command-bearing shell/search tool blocks visible in agent transcripts, and only explicit markdown file paths from path-bearing search blocks.
- [ ] OpenCode extraction includes candidates from shell/bash tool parts in parsed `opencode export` data.
- [ ] GitHub Copilot CLI extraction includes candidates from command execution events when command text is present.
- [ ] Dedicated read-tool entries and command-derived entries are returned in raw transcript/export order, including interleaving within a single message where the shape supports it.
- [ ] Directory-only searches, globs, and shell output are not counted unless explicitly implemented and tested as part of this task.
- [ ] Unknown or malformed harness-specific shapes still produce no entries rather than throwing.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Modify the extraction layer in `src/harnesses/read-extract.ts`. Keep per-harness extraction defensive and preserve existing return ordering as transcript/export order. If the implementation needs helper support from Task 1 in the usage layer, do not add schema fields or access-method metadata.

## Input Dependencies
Depends on Task 1's shared command-string candidate helper and explicit relative path-resolution contract.

## Output Artifacts
- Updated `extractClaudeReads`, `extractCodexReads`, `extractCursorReads`, `extractOpenCodeReads`, and `extractCopilotReads` behavior.
- No usage schema migration and no changes to persisted usage record fields.
- Updated top-of-file comments in `src/harnesses/read-extract.ts` so they no longer claim shell/search tools are ignored.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Use the existing per-harness parsing loops and append candidates from command-bearing tool shapes alongside the existing dedicated read paths.

Harness-specific starting points:

- Claude Code: Anthropic-style `tool_use` block named `Bash`; command at `input.command`.
- Codex CLI: rollout `function_call` or `tool_call` items for shell-style tools; command commonly lives in parsed arguments under `command`, `cmd`, or similar string keys. Include names such as `shell` or `exec_command` only when fixtures confirm the shape.
- Cursor: Anthropic-style transcript content blocks for shell/search tools; command text may live under `input.command` or a nearby command-like string key. A path-bearing search block may contribute only explicit `.md` file paths, not directories.
- OpenCode: parsed export parts with `type === "tool"` and shell/bash tool names; command text in `state.input`.
- Copilot: `tool.execution_start` events for command execution tools when `data.arguments` includes command text.

Keep tool names explicit and conservative. Dedicated read-tool entries must remain exactly as before. Shell/search candidates should be added in observed transcript order and duplicates must be retained. Do not parse assistant prose or tool-result stdout as part of this task.

Do not add global event-name translation or cross-adapter assumptions. This is extraction from raw transcript/export shapes only.
</details>
