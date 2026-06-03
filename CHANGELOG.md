## [0.26.4](https://github.com/e0ipso/ai-knowledge-base/compare/v0.26.3...v0.26.4) (2026-06-03)

### Bug Fixes

* avoid editing projects .gitignore ([8dafb92](https://github.com/e0ipso/ai-knowledge-base/commit/8dafb927f6ed04d11d4cf9f9d8a168184466522d))

## [0.26.3](https://github.com/e0ipso/ai-knowledge-base/compare/v0.26.2...v0.26.3) (2026-05-26)

### Bug Fixes

* resolve category 3 harness drift bugs ([039f4da](https://github.com/e0ipso/ai-knowledge-base/commit/039f4da39eacf16323201d998ab99b47066aa148))

## [0.26.2](https://github.com/e0ipso/ai-knowledge-base/compare/v0.26.1...v0.26.2) (2026-05-26)

## [0.26.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.26.0...v0.26.1) (2026-05-26)

## [0.26.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.25.2...v0.26.0) (2026-05-26)

### Features

* inject KB index pointer into AGENTS.md during init/upgrade ([2452b7a](https://github.com/e0ipso/ai-knowledge-base/commit/2452b7a31dae810aacf743e1de57aa94d98d2ea3))

### Bug Fixes

* increase nudge threshold ([e6b5d32](https://github.com/e0ipso/ai-knowledge-base/commit/e6b5d326a0569e0f5bd91fc872b30e3400474f5a))
* work towards harness parity ([732dce1](https://github.com/e0ipso/ai-knowledge-base/commit/732dce1d8454bbfcea49c9073798cddafb728dd4))

## [0.25.2](https://github.com/e0ipso/ai-knowledge-base/compare/v0.25.1...v0.25.2) (2026-05-26)

### Bug Fixes

* be cheaper ([68ef6a0](https://github.com/e0ipso/ai-knowledge-base/commit/68ef6a07af072f93c4e8a6ece7d0826b162246b6))

## [0.25.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.25.0...v0.25.1) (2026-05-26)

### Bug Fixes

* surface KB nudge to Cursor users ([ec8efcf](https://github.com/e0ipso/ai-knowledge-base/commit/ec8efcf36f59ab253c655e3e4820a26bfcf6ad79)), closes [#40](https://github.com/e0ipso/ai-knowledge-base/issues/40)

## [0.25.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.24.0...v0.25.0) (2026-05-26)

### Features

* add KB prefix to hook status messages ([c6f9f11](https://github.com/e0ipso/ai-knowledge-base/commit/c6f9f11b31879a0579ca6ddca12d2465f9977f44))

### Bug Fixes

* include pending-drain logs in session count ([8bdd08f](https://github.com/e0ipso/ai-knowledge-base/commit/8bdd08f607773e0bbd3b3ea1e29cb9ffc812f6e2))
* prevent updateGitignore from appending extra newline on each upgrade ([16982ef](https://github.com/e0ipso/ai-knowledge-base/commit/16982efbe5381cdb7491827d64df248dfb46ee6d))

## [0.24.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.23.0...v0.24.0) (2026-05-25)

### ⚠ BREAKING CHANGES

* session log frontmatter no longer
includes `secret_scan_status`. Existing logs with that
field will fail schema validation.

### Features

* remove secretlint integration ([9943721](https://github.com/e0ipso/ai-knowledge-base/commit/994372106c857686191cc48ab2bb90084aa68a51))

## [0.23.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.22.0...v0.23.0) (2026-05-25)

### Features

* initialize KB again ([1dc3228](https://github.com/e0ipso/ai-knowledge-base/commit/1dc322858013d2af9d474d5640e71b4a958c49b2))

## [0.22.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.21.0...v0.22.0) (2026-05-25)

### Features

* use alert emoji for overdue nudge ([ef60bf5](https://github.com/e0ipso/ai-knowledge-base/commit/ef60bf58cebb2143361d089b2ba4581430e17cd5))
* use systemMessage, drop throttle ([5dbd7c0](https://github.com/e0ipso/ai-knowledge-base/commit/5dbd7c0f366635b8fc19172341b1a0eec2869ac6))

## [0.21.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.20.0...v0.21.0) (2026-05-25)

### Features

* always show KB queue counts at start ([47f971e](https://github.com/e0ipso/ai-knowledge-base/commit/47f971eda98872c671c8fe9cd40b4e77e79a0b9f))

## [0.20.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.19.1...v0.20.0) (2026-05-24)

### Features

* always-on curation nudge via stderr ([7ba2cfa](https://github.com/e0ipso/ai-knowledge-base/commit/7ba2cfaf8e466ba093234695f16409c4c8bef909))
* two-tier proposal extraction with inline /kb-curate drain ([f82d257](https://github.com/e0ipso/ai-knowledge-base/commit/f82d257a1d49d3edbecccf3ab30e7bec4e165328))

## [0.19.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.19.0...v0.19.1) (2026-05-23)

### Bug Fixes

* update KB ([96378b6](https://github.com/e0ipso/ai-knowledge-base/commit/96378b66da95f242fba4be3348431a218ba6c70f))

## [0.19.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.18.0...v0.19.0) (2026-05-23)

### Features

* **kb-add:** delegate draft to sub-agent ([3eaca59](https://github.com/e0ipso/ai-knowledge-base/commit/3eaca59c11ab982e066e4f5c104810737f618e09))
* **kb-bootstrap:** parallel sub-agent draft ([46b09e7](https://github.com/e0ipso/ai-knowledge-base/commit/46b09e7754e28f9d429808b1fae84ef72dd9364a))
* **node-write:** lock bootstrap RMW (plan 32) ([60843ae](https://github.com/e0ipso/ai-knowledge-base/commit/60843aec517f74f6f37182e9e5cc7d1de01c4bc6))

## Unreleased

### Changed

* **`kb-bootstrap` and `kb-curate` now fan their drafting out across native host sub-agents** (up to 5 per orchestrator wave) on harnesses that expose a Task-style dispatch primitive (Claude Code, Cursor confirmed; Codex at the workflow level; opencode falls back conservatively). Harnesses without a native primitive silently degrade to the shipped sequential inline drafting path — no error, no warning, identical output.
* **`kb-add` now delegates its single drafting pass to one host sub-agent for context isolation** (not throughput), so the host transcript shows only the final summary and the accept/reject prompt rather than the agent's intermediate deliberation.
* **New per-batch JSONL artefacts** under `.ai/knowledge-base/_logs/{bootstrap,curator,kb-add}/` — one `<runId>__<batchN>.jsonl` per batch (one `<runId>.jsonl` for `kb-add`), append-only, gitignored. These are the cross-harness lowest-common-denominator trace; the matching `<runId>__<batchN>.draft.json` is only present when the parallel path ran. See [Daily use → Parallel drafting and per-batch logs](docs/daily-use.md#parallel-drafting-and-per-batch-logs) and [Troubleshooting → Bootstrap is still sequential — why?](docs/troubleshooting.md#bootstrap-is-still-sequential--why).

### Internal

* `node write` wraps its `bootstrap-state.json` read-modify-write in a short-lived `proper-lockfile` lock when invoked with both `--source-doc` and `--source-hash`, so concurrent persistence from parallel host sub-agents cannot drop hash-map entries. `proper-lockfile` was already a production dependency (used by `kb-proposal-drain`); no new dependencies added.

### Unchanged — CLI surface

* **The CLI surface is unchanged.** No flags added or removed, no positional arguments changed, no stdout contracts altered on `bootstrap`, `curate`, `node add`, or `node write`. The lock inside `node write` is internal; the help text, argument shape, and on-success/on-failure output match the plan-31 shipped form byte-for-byte. Callers that do not pass `--source-doc` / `--source-hash` take no lock at all.

## [0.18.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.17.0...v0.18.0) (2026-05-23)

### Features

* **cli:** add three deterministic KB primitives ([d1a76b9](https://github.com/e0ipso/ai-knowledge-base/commit/d1a76b97954eecd23ed8748fc4668631df4a090b))
* **hooks:** add emoji lifecycle feedback ([9809823](https://github.com/e0ipso/ai-knowledge-base/commit/98098232da73e8be42a89459c65eb26aa7e7603f))
* **skills:** drive bootstrap, curate, and add in host ([e196d9c](https://github.com/e0ipso/ai-knowledge-base/commit/e196d9c60d4de035f1af5dd7dae952a16c39572f))
## [0.17.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.16.0...v0.17.0) (2026-05-23)

### Features

* **bootstrap:** introduce .kbignore foundations ([16427ff](https://github.com/e0ipso/ai-knowledge-base/commit/16427ff85c6f75bedd764fc9182d5b4589a5c475))
* **cli:** kbignore-only scope for bootstrap ([ea4f37c](https://github.com/e0ipso/ai-knowledge-base/commit/ea4f37c5bca7cc8f1502365a1cbb9a56fc4a12f9))

## [0.16.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.15.0...v0.16.0) (2026-05-22)

### Features

* **bootstrap:** skip harness instruction dirs ([fa04732](https://github.com/e0ipso/ai-knowledge-base/commit/fa0473267723d1ab999b1991e204152c3f223d57))
* **headless:** tolerate wrapped curator JSON ([deb33b3](https://github.com/e0ipso/ai-knowledge-base/commit/deb33b395fcbd83af7b8a089ad88e6dfff49ed49))

## [0.15.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.14.0...v0.15.0) (2026-05-22)

### Features

* add Cursor harness adapter with native hooks integration ([057592a](https://github.com/e0ipso/ai-knowledge-base/commit/057592ab16fdb7a1c4ed89687e4f642b8b4920a9))

### Bug Fixes

* tighten Claude env detection and add Cursor to detect-harness ([79b4f45](https://github.com/e0ipso/ai-knowledge-base/commit/79b4f459f510e594d038786a0e2246574c026f27))

## [0.14.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.13.0...v0.14.0) (2026-05-21)

### Features

* **hooks:** add diagnostic utility + doc note ([368ff61](https://github.com/e0ipso/ai-knowledge-base/commit/368ff61502bfe05c76fdac49d527ff78f235a84e))
* **hooks:** record swallowed errors in 12 hooks ([2f9b216](https://github.com/e0ipso/ai-knowledge-base/commit/2f9b216cbe87f2679f20c3df64bf6095608e0c97))
* **session-start:** inject KB nav directive ([c431102](https://github.com/e0ipso/ai-knowledge-base/commit/c43110216f82e09e2917f38b03b865eee5bca708))

## [0.13.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.12.0...v0.13.0) (2026-05-21)

### Features

* **harness:** add memory-file ingestion plumbing ([bceeb3c](https://github.com/e0ipso/ai-knowledge-base/commit/bceeb3c7317d70eaaa78efeb4b0ac4ad04a8133a))
* **pipelines:** wire memory ingestion paths ([183f11c](https://github.com/e0ipso/ai-knowledge-base/commit/183f11c20bac268f7ed1ddfa005f6f58fe0439b9)), closes [#37](https://github.com/e0ipso/ai-knowledge-base/issues/37)

## [0.12.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.11.1...v0.12.0) (2026-05-21)

### Features

* **curate:** reduce curation friction ([599af39](https://github.com/e0ipso/ai-knowledge-base/commit/599af3999b305807704e964adb6dc591a36b76ff)), closes [#29](https://github.com/e0ipso/ai-knowledge-base/issues/29) [#29](https://github.com/e0ipso/ai-knowledge-base/issues/29)

## [0.11.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.11.0...v0.11.1) (2026-05-20)

## [0.11.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.10.1...v0.11.0) (2026-05-19)

### Features

* **curate:** expand conflict-resolution output ([65403bf](https://github.com/e0ipso/ai-knowledge-base/commit/65403bfcfc02dc68ad55e2a4f20bdcf54e2f5f6c))

### Bug Fixes

* update knowledge base ([08e8349](https://github.com/e0ipso/ai-knowledge-base/commit/08e8349b31ccad2bb4b03ead86ddb26017309fa8))

## [0.10.1](https://github.com/e0ipso/ai-knowledge-base/compare/v0.10.0...v0.10.1) (2026-05-19)

### Bug Fixes

* **hooks:** bundle hooks as self-contained .cjs ([19f934b](https://github.com/e0ipso/ai-knowledge-base/commit/19f934ba8b790a0cb5aa98ca78c6d2bd50f371f0))

## [0.10.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.9.0...v0.10.0) (2026-05-18)

### Features

* switch devcontainer from Claude Code to OpenCode ([a5d73d1](https://github.com/e0ipso/ai-knowledge-base/commit/a5d73d13261b2960026103b4e29a68ddaae339ef))

### Bug Fixes

* use comma in CHUNK and TRANSCRIPT placeholders to avoid hyphen/em-dash ambiguity ([ac33960](https://github.com/e0ipso/ai-knowledge-base/commit/ac339608f858e27c91474c562db3e3da151a6cf7))

## [0.9.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.8.0...v0.9.0) (2026-05-16)

### Features

* **opencode:** implement plugin and skills ([9180c66](https://github.com/e0ipso/ai-knowledge-base/commit/9180c666b154f16282a56e4f7caf7f9108a2b7d5))
* **opencode:** scaffold harness adapter ([d8de360](https://github.com/e0ipso/ai-knowledge-base/commit/d8de360244e540634599c7b9e67335967e568bb8))

### Bug Fixes

* **opencode:** dedent heredoc and add marker ([c66a5cc](https://github.com/e0ipso/ai-knowledge-base/commit/c66a5cc8feda43643240df1db99103d5063ba7d9))

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

### BREAKING CHANGES

* **`bootstrap-incremental` is now a deprecation alias for `bootstrap` and will be removed in the release after next.** The command was renamed; the alias prints a stderr deprecation notice on every invocation and accepts the same `--from <scope>` flag. Update scripts and CI invocations to call `bootstrap` directly.
* **Architecture: `bootstrap` and `curate` now run the LLM in the host harness session via a slash-command** (`/kb-bootstrap`, `/kb-curate`). The CLI commands are thin launchers that exec `<harness> -p "/kb-<name>"`; the LLM call happens once, in the host harness session, with the user's own model and prompt cache. Within that single host session, the skills fan drafting out to host-native sub-agents on harnesses that support it (see the **Changed** entries above); CLI-side subprocess fan-out via spawned harness binaries is gone for good. `node add` follows the same launcher pattern.

### Added

* **`finddocs [--from <scope>] [--with-hashes]`** — deterministic primitive that enumerates candidate markdown files for the KB, applying `.gitignore`, `.kbignore`, and the built-in static-skip list. Emits one `+ <relpath>` line per survivor; with `--with-hashes`, appends a tab-separated SHA-256 digest so callers can compare against `bootstrap-state.json`. Read-only, no LLM.
* **`node write <kind> <slug> [flags]`** — headless primitive that atomically writes a single node to `nodes/<kind>/<id>.md` with Zod-validated frontmatter and slug-collision resolution. Body read from stdin or `--from <path>`. When both `--source-doc <relpath>` and `--source-hash <sha256>` are passed, the same atomic transaction folds the entry into `bootstrap-state.json`'s per-file hash map (no separate state-mark step).
* **`curate-dedup [--input <path>]`** — deterministic primitive that validates a proposals JSON against `CuratorOutputSchema`, dedups, mints `${runId}-${n}` conflict ids, writes conflict files under `conflicts/`, and stamps consumed session logs with `curator_processed_at` / `curator_run_id`. Pure Node, atomic; replaces the dedup pass that used to live inside `CuratorRunner`.

### Removed

* **`@inquirer/prompts` dependency** — the `node add` interactive prompts are gone; the kb-add skill now collects fields conversationally in the host harness session and persists via `node write`.
* **`--timeout <ms>` flag on `curate`** — the curate command is now a launcher that execs the host harness; harness-side timeouts apply, not a CLI-level timeout.
* **`--dry-run`, `--yes`, and `--timeout <ms>` flags on `bootstrap`** — the bootstrap command is now a launcher. To preview discovery without writing, use `finddocs [--from <scope>]`. Confirmation gating happens in the host harness UI.
* **Flag-driven interactive `node add` prompts** — `--kind`, `--title`, `--summary`, `--body`, `--tags`, `--relates-to`, `--confidence`, `--yes` on `node add` are gone (they migrated to the `node write` primitive for headless use, and to the kb-add skill for interactive use).
* **Internal runner-embedded prompt files** — `src/templates-source/prompts/bootstrap-incremental.md` and `src/templates-source/prompts/curator.md`. Each skill's canonical prompt now lives at `src/templates-source/skills/kb-<name>/SKILL.md` and runs in the host harness session. The proposal-drain hook's prompt (`proposal-extract.md`) is unchanged.
* **`BootstrapRunner` and `CuratorRunner` classes** and their `runHeadless` paths. Skill sessions are single-author at the host level; concurrent persistence from parallel host sub-agents inside a single `kb-bootstrap` invocation is made safe by an internal `proper-lockfile` lock around `node write`'s `bootstrap-state.json` RMW (see the **Internal** entry above). Running two top-level `curate` or `bootstrap` invocations against the same repo concurrently remains unsupported (see [Daily use → No concurrent invocations](docs/daily-use.md#no-concurrent-invocations-of-curate-or-bootstrap)).

* **BREAKING** `--from`, `--include`, and `--exclude` flags on `bootstrap-incremental`. The scan now always walks the repo root and is scoped exclusively by `.kbignore` at the repo root. Rewrite old invocations using the migration table in the [README](README.md#migrating-from---from----include----exclude).
* **BREAKING** automatic injection of `harnessInstructionSkipPatterns` into the bootstrap walk. The same surface (every registered adapter's `skillsDir`, `commandsDir`, `hooksDir`, `pluginsDir`) is now expressed as uncommented entries in the default `.kbignore` stub written by `init`. The `harnessInstructionSkipPatterns` symbol is removed from `src/`; embedders that imported it must read `.kbignore` instead.
* **BREAKING** `--dry-run` flag on `init --upgrade`. The upgrade path applies changes directly; review with `git diff` before committing.
* **BREAKING** `.ai/knowledge-base/.state/pending-conflicts.json`. Curator `contradict` outcomes are written as one markdown file per conflict under `.ai/knowledge-base/conflicts/<runId>-<n>.md`. The reviewer accepts with `git commit` and rejects with `git restore`. `ai-knowledge-base conflict list` / `conflict resolve` subcommands are gone with the file. `PendingConflictsFileSchema`, `ConflictReportSchema`, and `countPendingConflicts` are removed from the public schema surface.
* **BREAKING** husky, lint-staged, and secretlint scaffolding from `init`. `init` no longer adds `husky`, `lint-staged`, or `secretlint` packages or scripts to the consumer `package.json`, and no longer writes `.husky/`, `.secretlintrc.json`, or `.lintstagedrc.cjs`. Consumers wanting commit-time secret scanning install their own husky hook; see the README for the recommended CI pattern.
* **BREAKING** `init` no longer requires `package.json` at the repo root; non-Node repositories install cleanly.
* `doctor` checks for husky / lint-staged / `.secretlintrc.json` wiring (`checkCommitTimeSecretScan`, `checkSecretlint`).

### Added

* `.kbignore` — per-repo, repo-root-relative scope file using gitignore-style syntax. Replaces the old `--from` / `--include` / `--exclude` flags on `bootstrap-incremental`. Patterns are matched against repo-root-relative paths with forward slashes; `!` re-includes, trailing `/` matches directories, `**` matches any number of path segments. See the [README migration section](README.md#migrating-from---from----include----exclude) for the rewrite table.
* `init` (and `init --upgrade` when the file is missing) writes a `.kbignore` stub at the repo root. The stub is generated deterministically from the registered harness adapters and ships with uncommented denies for every adapter's instruction directories (skills, commands, hooks, plugins) so they don't pollute the KB scan. The stub is never overwritten — once present, the file is user-owned.
* `-y, --yes` flag on `bootstrap-incremental`. The command prompts for confirmation by default on a TTY; `--yes` skips the prompt. Running non-interactively (no TTY) without `--yes` aborts with exit 2 and the message `Refusing to run non-interactively without --yes. Re-run with --yes to confirm.` CI invocations must pass `--yes` explicitly.
* `doctor` warns when `.kbignore` is missing or contains only comments/whitespace: `\`.kbignore missing or empty. Run \`init --upgrade\` to regenerate the default stub, or add your own patterns.\``

### Unchanged

* Harness memory ingestion (Claude Code `CLAUDE.md`, Codex memory files, etc., delivered via each adapter's `listMemoryFiles()`) is unaffected by `.kbignore`. Memory files continue to feed `bootstrap-incremental` and `curate` through the same secretlint-redaction gate as before.

### Migration

* If you upgraded an existing install, run `npx @e0ipso/ai-knowledge-base init --upgrade` to generate the default `.kbignore` stub, then rewrite any old `--from` / `--include` / `--exclude` invocations using the table in the [README](README.md#migrating-from---from----include----exclude).

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
