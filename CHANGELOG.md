## [0.8.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.7.0...v0.8.0) (2026-05-15)

### Features

* **codex:** hook scripts and narrative docs ([68e1f0f](https://github.com/e0ipso/ai-knowledge-base/commit/68e1f0f0d7fb6e2d9ed3f537b30b8510bd93740a))
* **codex:** implement adapter modules ([416823e](https://github.com/e0ipso/ai-knowledge-base/commit/416823e9da7a5ed42716c131e12a0df8097217ed))
* **codex:** scaffold codex harness adapter ([f0bcd56](https://github.com/e0ipso/ai-knowledge-base/commit/f0bcd5653239b2387d6b9c54948e087204d72540))

### Bug Fixes

* **codex:** doctor and post-install messages ([ab23982](https://github.com/e0ipso/ai-knowledge-base/commit/ab23982ddbb287fc1e66a745fa758316dcf81889))

## [0.7.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.6.0...v0.7.0) (2026-05-15)

### Features

* **harnesses:** runtime detection + configurable default harness ([032d0b6](https://github.com/e0ipso/ai-knowledge-base/commit/032d0b660f00d8005f64743bd291f36bdeba1801))

## [0.6.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.5.0...v0.6.0) (2026-05-14)

### Features

* **bootstrap:** centralise STATIC_SKIPS deny list ([e1b2362](https://github.com/e0ipso/ai-knowledge-base/commit/e1b23620d8d3fcc262ec9b1da636543459712da7))
* **kb-bootstrap:** rewrite over deterministic CLI ([42af31a](https://github.com/e0ipso/ai-knowledge-base/commit/42af31a2430c0b1ff0c6c84dd540a2c6f6502c55))
* **kb:** trim LLM frontmatter surface (phase 1) ([5c6911e](https://github.com/e0ipso/ai-knowledge-base/commit/5c6911e1ddb6727a24f2b62e895fe541d73b5894))
* **kb:** trim LLM frontmatter surface (phase 2) ([f3a9431](https://github.com/e0ipso/ai-knowledge-base/commit/f3a94316d4a1f6a17064f4281f8e7981073e925a))

## [0.5.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.4.1...v0.5.0) (2026-05-14)

### Features

* **kb:** harden kb-add and add verify nudge ([7d52438](https://github.com/e0ipso/ai-knowledge-base/commit/7d524386ffd5d70ebb6e03d80fbfa1bdc1822ab8))

### Bug Fixes

* **cli:** use scoped npx form in hint strings ([9fcf09e](https://github.com/e0ipso/ai-knowledge-base/commit/9fcf09e6223e5ca63d272283c38d0ebef029cae2))

## [0.4.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.4.0...v0.4.1) (2026-05-14)

### Bug Fixes

* **curate:** align BATCH_PLACEHOLDER with prompts ([d5e1765](https://github.com/e0ipso/ai-knowledge-base/commit/d5e17652ae6a1b30085d640e283fbf651558e507))

## [0.4.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.3.0...v0.4.0) (2026-05-14)

### Features

* **cleanup:** remove speculative abstractions ([b695e82](https://github.com/e0ipso/ai-knowledge-base/commit/b695e8246ed8555fe6a1fed4a1bc8ffc0b63616a))
* **cli:** wire conflict subcommands ([df45e8b](https://github.com/e0ipso/ai-knowledge-base/commit/df45e8bd55cbd2977920e9a8433d29730aa99ea0))
* **conflict:** add CLI conflict command group ([7dabccb](https://github.com/e0ipso/ai-knowledge-base/commit/7dabccba7c47e6ecca994d2c2575730b4f2abc42))
* **wrapper:** pre-tag and pre-filter cursory ([149aa70](https://github.com/e0ipso/ai-knowledge-base/commit/149aa7020c4244fa7e8a7da0b3a1412bac32794b))

### Bug Fixes

* **adapter:** resolve hook paths via env var ([360a36b](https://github.com/e0ipso/ai-knowledge-base/commit/360a36b9d7a0780325e4796119112bd10917c3c4))

## [0.3.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.2.0...v0.3.0) (2026-05-13)

### ⚠ BREAKING CHANGES

* node frontmatter and CuratorAction +
CuratorProposedNode shapes are slimmer; older node files do not
validate against the new NodeFrontmatterSchema.
* **index:** removes the --budget-tokens CLI flag and the
indexBudgetTokens config key. INDEX.md is now a catalog of every
valid node, sorted by graph in-degree DESC with title ASC
tiebreaker, plus a ## By topic block that lists every distinct
tag with the titles that carry it. Section headings change to
## Conventions and ## Components.

Per-bullet payload drops the summary; bullets render as title,
path, and #-prefixed tags. The frontmatter loses budget_tokens
and gains nothing in its place (estimated_tokens was considered
as observability but cut as YAGNI: no consumer reads it).
MIN_PER_KIND, DEFAULT_BUDGET_TOKENS, trimOldest, and
hiddenByBudget are deleted.

IMPLEMENTATION.md §8/§9, docs/cli-reference.md,
docs/how-it-works.md, docs/internals/schemas.md,
docs/internals/manual-test-plan.md, and the
map-index-and-graph-files KB node are rewritten to describe the
current design.
* every on-disk shape that previously carried the
stage_2_* keys bumps schema_version from 1 to 2 as a clean break.
No migrator ships. Users should delete _sessions/ and the old
_logs/stage-2/ on upgrade.

Renamed identifiers and surfaces:

* Session-log frontmatter: stage_2_status, stage_2_completed_at,
  stage_2_error, stage_2_log become proposal_status,
  proposal_completed_at, proposal_error, proposal_log.
* Settings keys: stage2Timeout, stage2Model become proposalTimeout,
  proposalModel.
* Section headings in session logs: Stage 1 (redacted transcript
  slice) and Stage 2 (structured summary) become Transcript and
  Proposal.
* Bundled hook filename: kb-stage2-drain.mjs becomes
  kb-proposal-drain.mjs.
* Prompt template: prompts/stage-2-extract.md becomes
  prompts/proposal-extract.md (Version bumped on all three prompts).
* Log subdirectory: _logs/stage-2/ becomes _logs/proposal/.
* state.json lock name: stage2-drain becomes proposal-drain.
* TS types and Zod schemas: Stage2Status, Stage2Candidate,
  Stage2Output, Stage2Runner become ProposalStatus,
  ProposalCandidate, ProposalOutput, ProposalRunner.

KB nodes, INDEX.md, GRAPH.md, PRD.md, IMPLEMENTATION.md, README.md,
docs/, and the kb-curate skill are rewritten under the new
vocabulary. CHANGELOG.md records the breaking entry.
* The `_proposed/` directory and the `proposal:`
frontmatter block are removed. Skills, the curator, manual
`node add`, and bootstrap all write directly to
`nodes/<kind>/<id>.md`. Acceptance is `git commit`; rejection is
`git restore <path>`.

The lint-staged pre-commit hook runs `ai-knowledge-base index
rebuild --stage` on any staged `nodes/**/*.md`, regenerating
INDEX.md and GRAPH.md and staging them into the same commit, so
the index never drifts from the committed nodes. `init` writes
`.lintstagedrc.cjs` (with `--concurrent false` in
`.husky/pre-commit` for serial execution) instead of patching
`package.json` with a `lint-staged` block.

Curator action handling: `add` writes a new node (fail-loud as
`add_collision` if the file already exists); `modify` overwrites
the target (fail-loud as `modify_missing_target` if the target
is absent); `contradict` records the conflict in
`.ai/knowledge-base/.state/pending-conflicts.json` instead of
writing. The kb-curate skill resolves conflicts in-session with
the user.

Schema changes: `BootstrapDocEntrySchema.produced_proposals` is
renamed to `produced_nodes`; `CurateResult.proposalsWritten` is
renamed to `nodesWritten` and gains `failures: FailureReport[]`
and `conflicts: ConflictReport[]` arrays. `ProposalKindSchema`,
`ProposalBlockSchema`, and `ProposalFrontmatterSchema` are
removed.

### Features

* **curate:** add verbose mode and batch hooks ([8369f7f](https://github.com/e0ipso/ai-knowledge-base/commit/8369f7fb9689eeb80e94eaaacc2fcc63caa13a7d))
* drop _proposed/, write nodes/ directly ([2692fe6](https://github.com/e0ipso/ai-knowledge-base/commit/2692fe69b37f75468b947713d19c8b1ae7ba4590))
* drop supersession from knowledge base ([f2bb8d6](https://github.com/e0ipso/ai-knowledge-base/commit/f2bb8d67a932c91ef15bcd68d650f74f8469995a))
* **index:** catalog model, drop budget trim ([f031d8f](https://github.com/e0ipso/ai-knowledge-base/commit/f031d8fd80c449b2c37ad9a627e1c88738e8b154))
* **lint:** add KB lint library and state plumbing ([1ba26ff](https://github.com/e0ipso/ai-knowledge-base/commit/1ba26ffe3fd255c863085780d2f951c12f50dcc6))
* **lint:** wire CLI, hook, and start-up nudge ([e071fdb](https://github.com/e0ipso/ai-knowledge-base/commit/e071fdbbc2553a48b7661040e5bb23a4ffeabce1))
* **prompts:** add session-disposition gate ([9ca9219](https://github.com/e0ipso/ai-knowledge-base/commit/9ca92198168c3ae074ee8b1b3e90b87e6b0664b3))
* **prompts:** end-state framing, signal capture ([5d6bb2f](https://github.com/e0ipso/ai-knowledge-base/commit/5d6bb2fb3f152cc7f8ea7a71b8ecaa58b9182493))
* **schema:** per-context model and effort knobs ([5611527](https://github.com/e0ipso/ai-knowledge-base/commit/5611527047f3d1782b987874acb6d9ed2ddc22db))
* setup task manager and kb ([44e76b3](https://github.com/e0ipso/ai-knowledge-base/commit/44e76b3e3eaef774672e19b155028c5293d56bc0))
* use lintstaged ([eaf40f2](https://github.com/e0ipso/ai-knowledge-base/commit/eaf40f2ab8128dd01d1a028dfcb867c86a62659b))
* wire per-context model/effort to callers ([7468750](https://github.com/e0ipso/ai-knowledge-base/commit/7468750a1b5cd7ff3373f31f064b9644bba543eb))

### Bug Fixes

* **curate:** explain malformed JSON failures ([536f161](https://github.com/e0ipso/ai-knowledge-base/commit/536f1611bd671368d79b2d6306c02a7aa23ccb80))
* fail loud on invalid KB node frontmatter ([621afe0](https://github.com/e0ipso/ai-knowledge-base/commit/621afe0de3c536083f96f66d0cb8ef391c252522))
* **kb:** downgrade node schema_version from 2 to 1 ([2ba2b68](https://github.com/e0ipso/ai-knowledge-base/commit/2ba2b68eb63f5e57ff0eb8f9fe124eb6c6d46341))
* **kb:** rename stage2* config keys to proposal* ([3e65390](https://github.com/e0ipso/ai-knowledge-base/commit/3e6539044761ef2917becdc53e33ebb652ec9225))
* make config.yaml not JSON ([e38feae](https://github.com/e0ipso/ai-knowledge-base/commit/e38feaeede0db11d38f4a9d91918c22b5f228592))
* map devcontainer mount ([7484a4c](https://github.com/e0ipso/ai-knowledge-base/commit/7484a4c84f603d61b5509348cedbd516b5b2762f))
* on file per session ([e262292](https://github.com/e0ipso/ai-knowledge-base/commit/e2622927ca8c0666e90be4211c1da6d386a7fede))
* quote ISO timestamps in kb skill examples ([58f547b](https://github.com/e0ipso/ai-knowledge-base/commit/58f547be6ea28398f2c803384137e4f48d5f9a35))

### Code Refactoring

* rename stages to transcript/proposal ([3d8a797](https://github.com/e0ipso/ai-knowledge-base/commit/3d8a79735ea74624fb26183239fd80941098647a))

## Unreleased

### Removed

* **BREAKING** `--dry-run` flag on `init --upgrade`. The upgrade path applies changes directly; review with `git diff` before committing.
* **BREAKING** `.ai/knowledge-base/.state/pending-conflicts.json`. Curator `contradict` outcomes are written as one markdown file per conflict under `.ai/knowledge-base/conflicts/<runId>-<n>.md`. The reviewer accepts with `git commit` and rejects with `git restore`. `ai-knowledge-base conflict list` / `conflict resolve` subcommands are gone with the file. `PendingConflictsFileSchema`, `ConflictReportSchema`, and `countPendingConflicts` are removed from the public schema surface.
* **BREAKING** husky, lint-staged, and secretlint scaffolding from `init`. `init` no longer adds `husky`, `lint-staged`, or `secretlint` packages or scripts to the consumer `package.json`, and no longer writes `.husky/`, `.secretlintrc.json`, or `.lintstagedrc.cjs`. Consumers wanting commit-time secret scanning install their own husky hook; see the README for the recommended CI pattern.
* **BREAKING** `init` no longer requires `package.json` at the repo root; non-Node repositories install cleanly.
* `doctor` checks for husky / lint-staged / `.secretlintrc.json` wiring (`checkCommitTimeSecretScan`, `checkSecretlint`).

### Changed

* `doctor` consolidates the two installed-version checks into a single check that reports the installed CLI version and flags drift from the package on disk.

### Internal

* `src/lib/hook-spec.ts` is the single source of truth for the three Claude Code hook registrations (`kb-capture`, `kb-proposal-drain`, `kb-session-start`). `init`, `init --upgrade`, and `doctor` read from `HOOK_SPECS`; the duplicated `EXPECTED_HOOK_COMMANDS` and `EXPECTED_HOOK_SCRIPTS` constants are gone.

### Changed

* Numeric CLI options now throw `commander.InvalidArgumentError` on non-integer input. Passing `--timeout abc` to `curate` or `bootstrap-incremental` exits non-zero with `error: option '--timeout <ms>' argument 'abc' is invalid. --timeout must be an integer (got "abc")` instead of silently coercing to `NaN`.
* `state.json` is locked by `proper-lockfile` instead of an in-band, hand-rolled named lock with PID/TTL bookkeeping. The lock applies to whatever process holds it; cross-command mutual exclusion is unchanged. Stale locks (e.g. from a crashed process) are cleared by `proper-lockfile`'s standard PID/mtime checks. Existing `state.json` files carrying the obsolete `lock` field still load: `StateFileSchema` silently drops the unknown key on the next write.
* The curator prompt is now Version 5. The curator no longer receives the `index_summary` (`INDEX.md` body) on every batch. It is told to emit a `drop` action with a rationale when a candidate appears to overlap an existing node that was not passed in via `existing_nodes`.

### Removed

* `node add --preset` flag (undocumented test seam). Tests exercise the write path through a new exported `writeNewNode(answers, { paths })` function.
* `FailureReportSchema` (Zod object that was never used as a validator). `FailureReport` is now a plain TypeScript interface in `src/lib/schemas.ts`.
* `--verbose` (`-v`) flag on `ai-knowledge-base curate`. The 15-second per-batch heartbeat lines (`still running (Xs)…`) are also gone. The run now prints a `follow live: tail -f <log path>` hint immediately under `curator log: ...`; users tail the canonical log for live progress.
* `lockTtlMs` setting (already absent from `SettingsSchema`; now also gone from the `CurateContext` / `BootstrapContext` / `DrainContext` interfaces).
* `DEFAULT_LOCK_TTL_MS`, `LockOptions`, `acquireLock`, `releaseLock`, `StateLockSchema`, the `lock` field on `StateFileSchema`, the `CURATOR_LOCK_NAME` / `BOOTSTRAP_LOCK_NAME` / `PROPOSAL_LOCK_NAME` constants, and the orphan `currentPid` helper in `src/lib/process.ts`.
* `index_summary` field on `CuratorBatchPayload`. `buildBatchPayload` no longer reads `INDEX.md` and no longer requires the `kbDir` parameter.

### Internal

* Shrunk the production context interfaces by removing test seams. `RunHeadlessOptions.spawn?`, `BootstrapContext.now?`/`pid?`, `CurateContext.now?`/`pid?`, and `DrainContext.now?`/`pid?` are gone. The six-or-seven per-context path fields collapse into a single `paths: RepoPaths` reference. Tests substitute behaviour at the import boundary (`vi.mock('execa')`, `vi.useFakeTimers({ toFake: ['Date'] })`).

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
* Curator surfaces contradictions as one markdown file per conflict under `.ai/knowledge-base/conflicts/<runId>-<n>.md`. The reviewer reads each file with `git diff`, accepts the proposed replacement with `git commit`, and rejects it with `git restore`.
* `add` actions targeting an existing node and `modify` actions whose target is missing are reported as structured failures (`add_collision`, `modify_missing_target`) rather than silently overwriting or dropping.
* `ai-knowledge-base status` reports curator-conflict count and a per-kind node tally.

## [0.2.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.1.1...v0.2.0) (2026-05-11)

### Features

* drop "proposals review" command ([3ff6c83](https://github.com/e0ipso/ai-knowledge-base/commit/3ff6c835838e672f29b609bf3fbc78159cc41e7e))

## [0.1.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.1.0...v0.1.1) (2026-05-11)

### Bug Fixes

* trigger semantic release ([4bb0cdc](https://github.com/e0ipso/ai-knowledge-base/commit/4bb0cdc7a5ad187f7873a52f598b908f0c732c5f))
