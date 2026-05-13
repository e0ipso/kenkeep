## Unreleased

### BREAKING CHANGES

* Renamed the two-step capture pipeline to Transcript / Proposal across code, configuration, frontmatter, prompts, file paths, and docs.
    * Session-log frontmatter keys: `stage_2_status` becomes `proposal_status`, `stage_2_completed_at` becomes `proposal_completed_at`, `stage_2_error` becomes `proposal_error`, `stage_2_log` becomes `proposal_log`.
    * Settings keys: `stage2Timeout` becomes `proposalTimeout`, `stage2Model` becomes `proposalModel`.
    * Bundled hook: `.claude/hooks/kb-stage2-drain.mjs` becomes `.claude/hooks/kb-proposal-drain.mjs`.
    * Prompt template: `prompts/stage-2-extract.md` becomes `prompts/proposal-extract.md`.
    * Log subdirectory: `_logs/stage-2/` becomes `_logs/proposal/`.
    * Session-log section headings: `## Stage 1: redacted transcript slice` becomes `## Transcript`; `## Stage 2: structured summary` becomes `## Proposal`.
    * Lock name `stage2-drain` becomes `proposal-drain`.
    * On upgrade, delete `.ai/knowledge-base/_sessions/` and `.ai/knowledge-base/_logs/stage-2/` (both are gitignored and reproducible from future sessions): `rm -rf .ai/knowledge-base/_sessions .ai/knowledge-base/_logs/stage-2`.

* The `_proposed/` directory and the `proposal:` frontmatter block have been removed. Skills, the curator, manual `node add`, and bootstrap all write directly to `nodes/<kind>/<id>.md`. Acceptance is `git commit`; rejection is `git restore <path>`. Existing repositories with a populated `_proposed/` directory must hand-promote any in-flight proposals into `nodes/` (strip the `proposal:` block, move the file) and then delete the `_proposed/` directory before upgrading.
* `BootstrapDocEntrySchema.produced_proposals` renamed to `produced_nodes`. Entries are bare `<kind>/<filename>.md` paths relative to `nodes/`.
* `CurateResult.proposalsWritten` renamed to `nodesWritten`. New fields `failures: FailureReport[]` and `conflicts: ConflictReport[]` carry per-action outcomes.
* `init` writes `.lintstagedrc.cjs` and no longer adds a `lint-staged` block to `package.json`.

* Removed several speculative abstractions and dead fields. No user action is required; existing on-disk artifacts with stray fields parse cleanly under the new schemas (Zod ignores unknown keys).
    * `src/adapters/` is gone. The hook-installation helper is now the free function `writeClaudeHookConfig` in `src/lib/hooks-config.ts`; subprocess spawning goes through `runHeadlessClaude` from `src/lib/headless.ts` directly.
    * `NodeFrontmatterSchema.depends_on` removed. `GRAPH.md` no longer renders a `depends_on` line.
    * `SessionLogFrontmatterSchema.topics` removed. Rendered session logs no longer include a `topics:` line.
    * `RoleTaggedTranscript` shrunk to a single `interleaved` field; the parallel `user` and `agent` arrays are gone.
    * The unused `packageName()` export from `src/lib/version.ts` is removed.

### Features

* `ai-knowledge-base index rebuild --stage` regenerates `INDEX.md`/`GRAPH.md` and runs `git add` on the result. Wired into the lint-staged pre-commit step on `nodes/**/*.md` so the index lands in the same commit as any node change. No-ops outside a git repo.
* Curator surfaces contradictions via `.ai/knowledge-base/.state/pending-conflicts.json`. The `/kb-curate` skill walks each entry with the user in-session and applies the chosen resolution.
* `add` actions targeting an existing node and `modify` actions whose target is missing are reported as structured failures (`add_collision`, `modify_missing_target`) rather than silently overwriting or dropping.
* `ai-knowledge-base status` reports curator-conflict count and a per-kind node tally.

## [0.2.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.1.1...v0.2.0) (2026-05-11)

### Features

* drop "proposals review" command ([3ff6c83](https://github.com/e0ipso/ai-knowledge-base/commit/3ff6c835838e672f29b609bf3fbc78159cc41e7e))

## [0.1.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.1.0...v0.1.1) (2026-05-11)

### Bug Fixes

* trigger semantic release ([4bb0cdc](https://github.com/e0ipso/ai-knowledge-base/commit/4bb0cdc7a5ad187f7873a52f598b908f0c732c5f))
