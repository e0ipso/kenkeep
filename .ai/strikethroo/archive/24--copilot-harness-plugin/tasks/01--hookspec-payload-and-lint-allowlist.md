---
id: 1
group: "abstraction-polish"
dependencies: []
status: "pending"
created: 2026-05-15
skills:
  - typescript
---

# Widen HookSpec with optional payload and extend lint allowlist for copilot

## Objective

Two coupled abstraction-polish changes that make the Copilot adapter a pure addition rather than a special case:

1. Add an optional `payload?: Record<string, unknown>` field to `HookSpec` in `src/harnesses/types.ts`. The field is opaque to all shared code (install, doctor, registry). Only each adapter's own `hooks-config.ts` writer ever reads its own payload shape. This unblocks the Copilot writer from inventing per-event metadata like `{ bash, timeoutSec, env, cwd }` outside the `HookSpec`.
2. Extend the `id` allowlist in the detect-harness heredoc inside `src/templates-source/skills/kb-curate/SKILL.md` (and any sibling SKILL.md that copies the heredoc) to include `'copilot'`. Confirm `scripts/lint-detect-harness.mjs` stays green after the edit and fails when `'copilot'` is removed from the heredoc allowlist.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `HookSpec` in `src/harnesses/types.ts` declares `payload?: Record<string, unknown>` as the only addition; no other field changes
- [ ] Claude, Codex, and OpenCode adapters' `hook-spec.ts` files compile without modification (the field is optional)
- [ ] `src/templates-source/skills/kb-curate/SKILL.md` (and any other SKILL.md sharing the heredoc) has `'copilot'` added to the id allowlist literal
- [ ] `node scripts/lint-detect-harness.mjs` exits 0
- [ ] Removing `'copilot'` from the heredoc literal in a scratch edit causes the lint to exit non-zero (revert after verifying)
- [ ] `npm run build` succeeds; `npm test` passes
- [ ] Per `feedback_no_backwards_compat`: no shim, no deprecated alias, no "legacy" comment markers anywhere

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/types.ts`
- `src/templates-source/skills/kb-curate/SKILL.md` (and any sibling SKILL.md that mirrors the heredoc id allowlist)
- `scripts/lint-detect-harness.mjs` (no changes expected; only confirms drift is caught)

## Input Dependencies

None.

## Output Artifacts

- `HookSpec.payload` available for the Copilot writer to consume
- Heredoc id allowlist includes `'copilot'`, lint passes

## Implementation Notes

<details>
<summary>Guidance</summary>

- The field MUST be optional (`payload?:`). Existing adapters do not need to declare it; their writers will not read it.
- The plan calls the field opaque on purpose: no schema, no validation in shared code. Each adapter's `hooks-config.ts` owns the shape.
- For the lint allowlist edit: locate the heredoc inside `src/templates-source/skills/kb-curate/SKILL.md` (search for the existing id list `['claude', 'codex', 'opencode']` or similar). Insert `'copilot'` preserving sort order. If multiple SKILL.md files share the heredoc verbatim, edit them all; the lint already enforces drift between them.
- The recursion-guard literal `KB_BUILDER_INTERNAL=1` is not touched by this task.
- Per `feedback_no_em_dashes`: no `—`, `–`, or ` - ` in comments or doc-strings.

</details>
