---
id: 5
group: "documentation"
dependencies: [2, 3, 4]
status: "completed"
created: 2026-05-23
skills:
  - technical-writing
  - markdown
---
# Update docs (`daily-use.md`, `how-it-works.md`, `troubleshooting.md`) and CHANGELOG to cover the restored parallelism and per-batch logs

## Objective

Reflect plan 32's restored parallelism in the user-facing docs and changelog: how it works (parallel-by-default with sequential fallback), where the new `_logs/{bootstrap,curator,kb-add}/` artefacts live, what to check when bootstrap is still sequential, and one CHANGELOG entry that explicitly states the CLI surface is unchanged.

## Skills Required

- `technical-writing` — concise, accurate prose tailored to newcomers (per the project's target-audience memory).
- `markdown` — Jekyll-compatible markdown in `docs/`.

## Acceptance Criteria

- [ ] `docs/daily-use.md` gains a short subsection (under an existing heading or a new one) explaining:
    - `kb-bootstrap` and `kb-curate` fan out across host sub-agents when the harness supports it; fall back to sequential drafting otherwise.
    - `kb-add` delegates its drafting pass for context cleanliness (same mechanism, not for throughput).
    - The new artefacts: `_logs/bootstrap/<runId>__<batchN>.jsonl`, `_logs/curator/<runId>__<batchN>.jsonl`, `_logs/kb-add/<runId>.jsonl` — what they are (lowest-common-denominator per-batch trace), where they live (`.ai/knowledge-base/_logs/`), and that they're gitignored.
    - A sentence noting "do not run `kb-bootstrap` and `kb-curate` simultaneously" (mitigation for the cross-skill race risk from plan §Integration Risks).
- [ ] `docs/how-it-works.md` updates its architecture description to show the host-Task-agent fan-out as an inner detail of the host session. The launcher-as-single-exec model at the outer layer (`launchSkill`) is explicitly preserved and unchanged. If a diagram exists, update it; if only prose, update prose accordingly.
- [ ] `docs/troubleshooting.md` gains a new entry titled approximately "Bootstrap is still sequential — why?" that:
    - Briefly explains the per-harness capability matrix (Claude Code and Cursor: documented native Task; Codex: workflow-level; opencode: conservative fallback by default).
    - Explains the probe-and-fallback behaviour — silent degrade is by design, never an error.
    - Points to the `_logs/bootstrap/` artefacts as the way to confirm whether the parallel or fallback path ran.
- [ ] `CHANGELOG.md` gains one entry under the next release noting:
    - Restored parallel drafting in `kb-bootstrap` and `kb-curate`; `kb-add` delegates for context isolation.
    - New per-batch JSONL artefacts under `.ai/knowledge-base/_logs/{bootstrap,curator,kb-add}/`.
    - Internal `proper-lockfile` lock added inside `node write` around `bootstrap-state.json` RMW.
    - **Explicit statement that the CLI surface is unchanged** (no flag, no positional-arg, no stdout-contract changes).
- [ ] `AGENTS.md` is NOT modified (plan explicitly states no changes required there).
- [ ] No KB node files under `.ai/knowledge-base/nodes/` are added by this task (plan explicitly states "No new KB node is required for this plan").
- [ ] All updated markdown files render cleanly through whatever local lint the project uses (run `npm run lint` to verify nothing tripped a markdown rule, then `npm test` to confirm no doc-based test fixtures regressed).

## Technical Requirements

- Edit existing files; do not create new top-level docs. (The `docs/troubleshooting.md` entry is a new subsection inside an existing file, not a new file.)
- The audience is newcomers (memory entry "Target audience is newcomers") — frame the explanation so a first-time reader can follow without having read the source.
- Keep additions tight — the docs are the long-term reader-facing artefact; do not narrate the implementation.

## Input Dependencies

Depends on Tasks 2, 3, 4 because the docs describe the actual behaviour of the three updated SKILL.md files. The doc updates can be drafted in parallel with those tasks, but the final wording should be verified against the as-shipped SKILL.md sections (e.g. the `_logs/<skill>/` path naming, the JSONL line conventions, the cap-of-5 wave size).

## Output Artifacts

- Updated `docs/daily-use.md`, `docs/how-it-works.md`, `docs/troubleshooting.md`.
- Updated `CHANGELOG.md`.

## Implementation Notes

<details>

### Tone and length

- Target a newcomer who installed the package today.
- Each doc edit should be one short subsection (3–6 sentences) plus optionally a small code block for the artefact paths.
- The CHANGELOG entry should be 3–5 bullets, not paragraphs.

### Concrete artefact paths to mention

```
.ai/knowledge-base/_logs/bootstrap/<runId>__<batchN>.jsonl
.ai/knowledge-base/_logs/curator/<runId>__<batchN>.jsonl
.ai/knowledge-base/_logs/kb-add/<runId>.jsonl
```

These directories are already under the gitignored `_logs/` root (constitution principle 4 — `_logs/` is per-user state). Mention this in `daily-use.md` so readers don't expect them to land in PRs.

### CHANGELOG entry shape

Look at the existing CHANGELOG format and match it. The entry should sit at the top under whatever the "unreleased" / next-version heading is. Don't bump the package version — that's a release-time concern.

### KB recheck

The plan calls out: "re-check `practice-recursion-guard-kb-builder-internal` after implementation to confirm `KB_BUILDER_INTERNAL` semantics are still accurate." This recheck does NOT belong in this task — it's a passive read of a KB node to confirm no change. If the node is still accurate (it should be — `KB_BUILDER_INTERNAL` is a hook-recursion guard, unrelated to host sub-agent dispatch), no action is needed. If it's stale, raise it to the user; do not silently edit a KB node from a documentation task.

### Skill scope

`technical-writing` + `markdown`. No code changes. No SKILL.md changes. No new files.

</details>
