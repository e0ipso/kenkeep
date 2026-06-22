---
id: 3
group: "skills"
dependencies: []
status: "completed"
created: 2026-06-21
skills:
  - technical-writing
---
# Verify and complete curator skill resilience instructions

## Objective
Ensure the shipped `/kk-curate` source skill documents the operational
fallbacks observed in issue #61, and that any dependent skill (notably
`kk-session-extract`) stays consistent. Commit `e14fe72` already edited several
`src/templates-source/skills/*/SKILL.md` files; verify against the plan's
success criteria and complete any gap. Source-only edits — never hand-edit
generated `templates/`.

## Skills Required
Technical writing for operational skill instructions (precise, localized,
non-verbose).

## Acceptance Criteria
- [ ] `src/templates-source/skills/kk-curate/SKILL.md` documents the `EBUSY` fallback: retry the SAME argv through Python `subprocess.run([...])` list form (preserving argument boundaries), scoped to CLI calls the skill already requires.
- [ ] It documents the harness-detector fallback: when `kk-detect-harness.mjs` cannot run, read `.ai/kenkeep/.state/installed-version`; pick a harness only when the installed list + runtime hint make it unambiguous, otherwise ask the user.
- [ ] It documents recursive/direct session-log discovery when a flat `.ai/kenkeep/_sessions/*.md` glob returns no matches despite the directory existing.
- [ ] It documents using `kenkeep curate-persist --input <survivors>` for batch survivor persistence (replacing per-survivor `node write` loops).
- [ ] It documents the grouped `create-branch` trigger semantics (reading `branches`/`topic` metadata) so the LLM rebalance phase consumes coherent groups.
- [ ] `kk-session-extract` source skill is updated if and only if it references survivor persistence, so it stays consistent with `curate-persist`.
- [ ] No general-purpose `kenkeep exec` wrapper is introduced (documented subprocess fallback is sufficient).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Edit only under `src/templates-source/skills/`. Generated `templates/` is produced by the build (handled in task 04).
- Keep guidance operational and localized: exact fallback command shape, exact fallback files, exact grouped-action semantics. The skill is already long — do not pad it.

## Input Dependencies
Conceptually aligns with the grouped `create-branch` semantics from task 2 and
the `curate-persist` contract from task 1, but does not require their code to
run (documentation of agreed behavior).

## Output Artifacts
Verified/complete skill source under `src/templates-source/skills/`. Consumed by
task 04 (template build) and task 05 (drift validation).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Run `git show e14fe72 -- src/templates-source/skills/` to see existing edits. Preserve them; fill gaps only.
2. The EBUSY fallback must show retrying the identical argv via Python list form, not a shell string (preserves argument boundaries). Keep it scoped to the CLI invocations the skill already makes.
3. For harness fallback, instruct reading `.ai/kenkeep/.state/installed-version` and choosing a harness only when unambiguous; otherwise prompt the user.
4. For session discovery, mention listing the directory directly or a recursive glob (`**`) when the flat `*.md` pattern misses files.
5. Verify whether `kk-session-extract` SKILL.md delegates survivor persistence to `/kk-curate`; only touch it if so.
6. Do not regenerate templates here — task 04 owns the build. Report exactly which files you changed.
</details>
