---
id: 6
group: "documentation"
dependencies: [2, 3, 5]
status: "completed"
created: 2026-05-15
skills:
  - technical-writing
---

# Align project docs (PRD, README, docs/, CONTRIBUTING) with Copilot support

## Objective

Update narrative docs so Copilot appears as a first-class supported harness alongside Claude, Codex, and OpenCode. Document the user-level vs project-level Copilot hook file split, the `.github/skills/` install location, the absence of in-session env detection, and the `.github/copilot-instructions.md` sentinel block strategy.

## Skills Required

- technical-writing

## Acceptance Criteria

- [ ] `PRD.md` Section 2 (supported harnesses) lists Copilot; Section 11 (out-of-scope) drops any "Copilot adapter" bullet if present
- [ ] `README.md` quick-start paragraph adds a one-line Copilot install (`npx @e0ipso/ai-knowledge-base init --harnesses copilot`) and notes the `.github/skills/` skills location and the `.copilot/` project KB-tool dir
- [ ] `docs/installation.md` gains a "GitHub Copilot CLI" section covering: prerequisites (`npm i -g @github/copilot`, one-time `copilot /login`), the `init` command, the user-level `~/.copilot/hooks/kb.json` file (Copilot reads this; the project-level `.copilot/hooks/kb.json` is a documentation artifact), the absence of in-session env detection (must pass `--harness` / `--hint` or set `cliDefaultHarness: copilot`), the recommended `cliDefaultHarness: copilot` setting for Copilot-primary repos, the headless model recommendation (Claude Sonnet 4.5 if the user has access), and the `.github/copilot-instructions.md` sentinel block strategy for session-start context injection (including the known limitation: stdout is not a documented Copilot context-injection channel, so the sentinel block is the v1 workaround)
- [ ] `docs/cli-reference.md` notes that `--harness copilot` is now a valid value alongside the other three; the existing detect-harness recipe pattern documented under Plan 23 applies unchanged
- [ ] `docs/how-it-works.md` capture-pipeline section adds Copilot's `sessionEnd` / `agentStop` triggers and the `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl` transcript source
- [ ] `CONTRIBUTING.md` "Adding a new harness adapter" section adds one item: declare `payload` on `HookSpec` entries when the host's hook-config schema needs per-entry metadata; the adapter's own `hooks-config.ts` consumes the payload to render the native format
- [ ] No file in `docs/` or the root markdown set still claims "Copilot is not supported" or lists only Claude / Codex / OpenCode
- [ ] Per `feedback_no_em_dashes`: no `—`, `–`, or ` - ` as separators anywhere in the new prose; use commas, colons, or parentheses
- [ ] Per `feedback_no_retrospective_framing`: describe the current design only; never write "earlier versions did X" or "previously Copilot was deferred"

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `PRD.md`, `README.md`, `docs/installation.md`, `docs/cli-reference.md`, `docs/how-it-works.md`, `CONTRIBUTING.md`

## Input Dependencies

- Task 2 (adapter exists; `init --harnesses copilot` works)
- Task 3 (hooks-config + sentinel writer; needed to document the `~/.copilot/hooks/kb.json` and `.github/copilot-instructions.md` story)
- Task 5 (headless runner; needed for the `curate` / `bootstrap-incremental` mentions in `installation.md`)

## Output Artifacts

- Updated narrative docs reflecting the four-harness state and the Copilot specifics

## Implementation Notes

<details>
<summary>Guidance</summary>

- Use the existing OpenCode sections in `docs/installation.md` as a structural template. Mirror the headings, depth of detail, and tone.
- For the user-level hook scope caveat: document that `~/.copilot/hooks/kb.json` is installed once and fires for every repo where the user runs `copilot`; the hook scripts no-op silently when the cwd has no `.ai/knowledge-base/` directory.
- For the auth doctor caveat: document that the doctor check is heuristic (env var OR `~/.copilot/settings.json` presence) and may warn falsely if the user has a non-default `COPILOT_HOME`.
- For PRD section 11 (out-of-scope), remove any Copilot bullet but keep items still genuinely out-of-scope (Vercel `npx skills` integration, separate-repo skills package).
- Avoid the listed forbidden punctuation: a quick `grep -nP '[—–]' docs/installation.md` or `grep -n ' - ' README.md` sanity check before finalizing.
- The `preToolUse` permissionDecision contract is mentioned as an extensibility hook for advanced users in `installation.md` but is explicitly NOT wired by this plan.

</details>
