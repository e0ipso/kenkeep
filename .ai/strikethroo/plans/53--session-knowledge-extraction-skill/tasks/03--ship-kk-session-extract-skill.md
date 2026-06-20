---
id: 3
group: "session-knowledge-extraction"
dependencies: [1, 6]
status: "completed"
created: 2026-06-20
skills:
  - skill-authoring
  - harness-adapters
complexity_score: 9
complexity_notes: "Introduces a shipped shared skill, harness detection material, install/doctor expectations, optional launcher surface, strict live extraction instructions, scoped dedup invocation, and shared curation semantics without creating a second authority."
---
# Ship the kk-session-extract skill

## Objective
Add `/kk-session-extract` as a first-class shared skill that extracts durable knowledge from the current visible session, stages proposals through `session-log stage-live`, and then follows the existing `/kk-curate` curation tail with dedup stamping scoped to the staged session.

## Skills Required
- `skill-authoring` - write precise in-host skill instructions that apply `proposal-extract.md` unchanged and handle empty extraction correctly.
- `harness-adapters` - install the skill for every supported harness and keep doctor/init/upgrade expectations in sync.

## Acceptance Criteria
- [ ] `src/templates-source/skills/kk-session-extract/SKILL.md` exists, has a precise routing description, and distinguishes `/kk-session-extract` from `/kk-add` and `/kk-curate`.
- [ ] The skill includes the shared harness-detection materialization block and `scripts/lint-detect-harness.mjs` guards every shipped copy that embeds that block, not only `kk-curate`.
- [ ] The skill carries `<!-- Version: 1 -->`; existing prompt/skill Version comments are bumped only when their behavior changes.
- [ ] The skill loads `.ai/kenkeep/.config/prompts/proposal-extract.md` first and falls back to the bundled template, substitutes the live transcript for the prompt placeholder, and does not copy or weaken the extraction gate.
- [ ] The skill emits the current strict `ProposalOutputSchema` candidate shape only: `kind`, `tags`, `title`, `summary`, `body`, and `confidence`.
- [ ] Empty, meta-only, exploratory, abandoned, or unrelated sessions stop without staging a log or writing nodes.
- [ ] Non-empty extraction pipes validated proposal JSON into `session-log stage-live`, then follows the existing `/kk-curate` action drafting, a single scoped `curate-dedup` call, `node write`, `index rebuild`, rebalance, and conflict walkthrough flow.
- [ ] The scoped `curate-dedup` call uses the staged `session_id` from Task 1 / Task 6 so unrelated done logs are not stamped.
- [ ] Shared skill install/upgrade, doctor expectations, and any CLI launcher surface include `kk-session-extract`; the `LauncherSkill` union and launcher tests are updated if a CLI launcher is added.
- [ ] Generated `templates/` updates come only from `src/templates-source/` and the template build.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files likely involved: `src/templates-source/skills/kk-session-extract/SKILL.md`, `src/templates-source/skills/kk-curate/SKILL.md` if shared instructions or path corrections are needed, `src/lib/install-skills.ts`, `src/lib/launch-skill.ts`, `src/commands/*.ts` if a launcher command is added, `src/cli.ts`, `scripts/lint-detect-harness.mjs`, and install/doctor/upgrade/launcher tests.
- Do not spawn a headless harness from the skill and do not introduce daemons or background workers.
- Avoid creating a second divergent curation rulebook. Reference or factor the `/kk-curate` tail where possible, and keep `curate-dedup` as one call per run.
- Verify all session-log paths in any copied/factored curation instructions use `.ai/kenkeep/_sessions/*.md`, not `.ai/kenkeep/sessions/*.md`.
- Shipped skills must remain self-contained: no references to arbitrary repo-local files outside the installed package/consumer tree.

## Input Dependencies
- Task 1: `session-log stage-live` command contract.
- Task 6: scoped `curate-dedup` session-stamping contract.

## Output Artifacts
- A packaged `kk-session-extract` skill in the shared templates source and generated templates.
- Updated install, upgrade, doctor, detector-lint, and launcher surfaces as applicable.
- Tests or assertions proving the new skill is installed and recognized wherever shared skills are expected.

## Implementation Notes
This task is responsible for the user-facing workflow. It must make degraded idempotency visible when no matching UUID-v4 live session id is available, but it should still rely on whole-tree dedup as the secondary safety net.

<details>
<summary>Detailed implementation guidance</summary>

1. Use `src/templates-source/skills/kk-curate/SKILL.md` as the structural reference. The new skill should reuse its harness resolution block and curation tail semantics, but its front half operates on the current visible context instead of enumerating pending logs.
2. The extraction step should instruct the host agent to:
   - warn that context compaction may make the visible session partial;
   - load the prompt override first, then bundled `proposal-extract.md`;
   - substitute a role-tagged live transcript surrogate for `[TRANSCRIPT PLACEHOLDER, substituted at runtime]`;
   - apply the prompt to the live conversation and produce a strict `ProposalOutputSchema` object;
   - treat an empty valid output as success with no writes.
3. For non-empty output, pipe JSON to the Task 1 primitive. Preserve the staged log's `session_id` in candidate origins when drafting actions, but do not rely on `candidate_origin` for stamping.
4. For curation, either reference the existing `/kk-curate` steps directly or factor common prose so there remains one source of truth for action rules. Validate with grep that the new skill has not introduced a conflicting alternative action taxonomy.
5. Invoke `curate-dedup` once with the Task 6 scoped-stamping option for the staged session id. Do not run the default all-done-log stamping mode from `/kk-session-extract`.
6. If modifying `kk-curate/SKILL.md` while factoring common text or fixing `_sessions` paths, bump its Version comment and add tests that lock the corrected path.
7. Add `kk-session-extract` to `EXPECTED_SKILLS` and every test fixture or assertion that lists installed shared skills.
8. If the CLI has launcher commands for first-class skills, add an equivalent launcher for this skill and ensure `KENKEEP_BUILDER_INTERNAL=1` is still set on spawned harness children.
9. Run `npm run build:templates` or the repository's expected build command so generated `templates/skills/kk-session-extract/SKILL.md` appears from source.

</details>
