---
id: 10
group: "documentation"
dependencies: [4, 7, 8]
status: "completed"
created: 2026-05-15
skills:
  - technical-writing
---

# Align project docs (PRD, README, docs/, CONTRIBUTING) with OpenCode support

## Objective

Update narrative docs so OpenCode appears as a first-class supported harness alongside Claude and Codex, document the detect-harness recipe pattern, and add the new requirements for adding future harnesses.

## Skills Required

- technical-writing

## Acceptance Criteria

- [ ] `PRD.md` Section 2 (supported harnesses) lists OpenCode; Section 11 (out-of-scope) drops "OpenCode adapter"
- [ ] `README.md` adds a one-paragraph mention of OpenCode support near the Claude/Codex paragraphs
- [ ] `docs/installation.md` gains an "OpenCode" section covering: `npx @e0ipso/ai-knowledge-base init --harnesses opencode`, the `.opencode/` layout (plugin + kb-hooks + skills), the absence of in-session env detection (must pass `--hint` or set `cliDefaultHarness`), the disk-parse-with-export-fallback transcript strategy, and the recommended `cliDefaultHarness: opencode` setting for OpenCode-primary repos
- [ ] `docs/installation.md` documents the new Claude permission story: shared skills drop the per-harness `allowed-tools` frontmatter, so Claude users wanting pre-approval add `Bash(npx @e0ipso/ai-knowledge-base:*)` to `.claude/settings.json`
- [ ] `docs/cli-reference.md` documents the detect-harness recipe pattern (the `/tmp/kb-detect-harness.mjs` heredoc + `npx ... --harness "$HARNESS"` invocation) for skill authors writing their own KB-related skills
- [ ] `docs/how-it-works.md` capture-pipeline section updated to mention OpenCode's `session.idle` trigger and disk-parsed storage
- [ ] `CONTRIBUTING.md` "Adding a new harness adapter" section adds items: declare event vocabulary on the adapter (no global enum); choose `hooksDir` or `pluginsDir`; add env detector to `detect.ts` AND to the heredoc inside `src/templates-source/skills/kb-curate/SKILL.md`; verify `npm run lint:detect-harness` passes
- [ ] No file in `docs/` or the root markdown set still claims "OpenCode is not supported" or lists only Claude/Codex
- [ ] Per `feedback_no_em_dashes`: no `—`, `–`, or ` - ` as separators anywhere in the new prose; use commas, colons, or parentheses
- [ ] Per `feedback_no_retrospective_framing`: do not write "earlier versions did X" or "previously the skills were duplicated"; describe the current design only

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `PRD.md`, `README.md`, `docs/installation.md`, `docs/cli-reference.md`, `docs/how-it-works.md`, `CONTRIBUTING.md`

## Input Dependencies

- Task 4 (OpenCode adapter exists; install command works)
- Task 7 (headless runner; needed for the `curate` / `bootstrap-incremental` mentions in installation.md)
- Task 8 (shared skill tree; needed for the permission story and detect-harness recipe documentation)

## Output Artifacts

- Updated narrative docs reflecting the three-harness state and the new contributor checklist

## Implementation Notes

<details>
<summary>Guidance</summary>

- Use the existing Codex sections in `docs/installation.md` as a structural template. Mirror the headings, depth of detail, and tone.
- The detect-harness recipe section in `cli-reference.md` should include a copy-pastable bash snippet identical to the one in the shared SKILL.md (single source of truth: snippet appears verbatim in both, drift caught by reviewer on PR diff; no automated lint between docs and SKILL.md beyond Task 9's detect.ts/heredoc lint).
- For PRD section 11 (out-of-scope), remove the OpenCode bullet but keep any items still genuinely out-of-scope (Vercel `npx skills` integration, separate-repo skills package per plan clarifications).
- Avoid the listed forbidden punctuation. A quick `grep -nP '[—–]' docs/installation.md` or `grep -n ' - ' README.md` sanity check before finalizing.

</details>
