## Unreleased

### Changed

* Swapped six hand-rolled helpers for battle-tested libraries (or a single shared module).
    * Run-id minting moved from a Crockford ULID generator to `crypto.randomUUID()`. Log filenames under `_logs/bootstrap-incremental/` and `_logs/curator/`, and the `curator_run_id` frontmatter field on session logs, now embed a UUID v4. The `runId?: string` test seam on `BootstrapContext` and `CurateContext` is gone; `BootstrapResult.runId` and `CurateResult.runId` are required.
    * `--include`/`--exclude` matching and `.gitignore` parsing in `bootstrap-incremental` now use `picomatch` and `ignore` respectively. `.gitignore` negation (`!keep.md`) is honoured; previously every `!`-prefixed pattern was silently dropped. `DiscoverOptions.gitignorePatterns: string[]` is replaced by `DiscoverOptions.gitignore?: Ignore`.
    * `src/lib/log.ts` is reimplemented on top of `picocolors`. The `NO_COLOR` env var now follows the spec (any non-empty value disables colour) instead of the previous `NO_COLOR === '1'` check.
    * Session-log frontmatter is emitted via `js-yaml` `dump` rather than a hand-rolled line builder, while retaining the manual `---` fence.

### Removed

* `src/lib/ulid.ts` and the in-tree `globMatch` / `globToRegex` / `parseGitignore` exports from `src/lib/bootstrap.ts`. Consolidated three byte-identical `compactStamp` / `isoToCompactStamp` copies into `src/lib/time.ts`, and extracted the duplicated atomic-write and read-validate JSON patterns into `src/lib/fs-atomic.ts` (`atomicWriteJson`, `readJsonValidated`). `state.ts`, `lint-state.ts`, and `bootstrap.ts` import from the new helpers.

### Removed

* Shrunk the settings surface and dropped the user-level configuration layer.
    * `SettingsSchema` keys: `drainBound`, `maxAttempts`, `proposalTimeout`, `lockTtlMs`, `bootstrapTokenBudget`. On-disk `config.yaml` files holding any of these must be hand-edited; the strict schema rejects unknown keys.
    * User-level `config.yaml` at `~/.config/ai-knowledge-base/config.yaml` (`XDG_CONFIG_HOME` lookup). The project-level `.ai/knowledge-base/config.yaml` is now the only configuration file.
    * `warnings` array returned by `resolveSettings`. Malformed YAML or schema violations now throw an `Error` naming the offending file.
    * `logs prune --older-than` and `logs prune --dry-run` flags. The command now always uses `settings.logsRetentionDays` (default 30) and prints `pruned N files`.
    * Token-budget batching in bootstrap and curate: `CHARS_PER_TOKEN`, `DEFAULT_TOKEN_BUDGET`, `chunkDocs`, `batchSessions`, `estimateSessionTokens`, and the `--token-budget` CLI flag.

* Deleted seven defensive code paths that masked the failure modes they claimed to handle.
    * Prompt builders (`buildPrompt`, `buildBatchPrompt`, `buildProposalPrompt`) now throw a named error when their placeholder is missing instead of shipping a malformed template-plus-chunk concatenation.
    * `runHeadlessClaude` parses the trimmed final result with `JSON.parse` directly; the `extractJsonBlock` fence-stripping helper is gone. The previous `buildParseFailureMessage` (V8-specific `position N` regex plus a multi-line "next steps" block) collapses to a single inline error that names the log path.
    * `src/lib/dedup-cache.ts` and `DedupCacheFileSchema` are deleted. The session-id-based overwrite via `findSessionLogBySessionId` already keeps the file count at one per session; every Stop fire re-runs the secret scan and re-renders the log.
    * `.queue.json` and its retry rotation are removed. `src/lib/queue.ts`, `QueueFileSchema`, `QueueEntrySchema`, `appendToQueue`, `hasQueueEntry`, `removeFromQueueHead`, `bumpAndRotate`, the per-entry `attempts` counter, and the `'skipped'` `DrainEntryStatus` arm all delete. `drainProposalQueue` now sweeps `_sessions/*.md` for `proposal_status: pending` and writes `done` or `failed` per outcome.
    * `ensureUniqueId` tries three numbered suffixes and throws on the fourth collision instead of falling back to a SHA-256 discriminator.
    * A single `assertValidSessionId(sessionId)` boundary check in `src/lib/session-log.ts` replaces `shortSessionId`, the dash-tolerant cleanser in `proposalLogPath`, and the `hash.slice(7, 19)` fallback in `captureSession`. The hook validates `session_id` once against the UUID v4 shape; downstream code uses the lowercased value verbatim. Session-log filenames embed the full UUID after the `YYYYMMDD-HHmm` stamp.

### BREAKING CHANGES

* Renamed the two-step capture pipeline to Transcript / Proposal across code, configuration, frontmatter, prompts, file paths, and docs.
    * Session-log frontmatter keys: `stage_2_status` becomes `proposal_status`, `stage_2_completed_at` becomes `proposal_completed_at`, `stage_2_error` becomes `proposal_error`, `stage_2_log` becomes `proposal_log`.
    * Settings model key: `stage2Model` becomes `proposalModel`.
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

### Changed

* Project `config.yaml` is strict against unknown keys; a malformed or non-conformant file fails loudly naming the offending path instead of warning and falling back to defaults.
* Bootstrap batches docs in groups of 20, curate batches sessions in groups of 10, via the `chunk(items, size)` helper in `src/lib/chunk-batch.ts`.
* `logs prune` walks the whole `_logs/` tree recursively and deletes `*.jsonl` files older than `settings.logsRetentionDays`.

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
