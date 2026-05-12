## [1.2.0](https://github.com/e0ipso/ai-knowledge-base/compare/v1.1.0...v1.2.0) (2026-05-12)

### Features

* **curate:** add verbose mode and batch hooks ([8369f7f](https://github.com/e0ipso/ai-knowledge-base/commit/8369f7fb9689eeb80e94eaaacc2fcc63caa13a7d))
* **schema:** per-context model and effort knobs ([5611527](https://github.com/e0ipso/ai-knowledge-base/commit/5611527047f3d1782b987874acb6d9ed2ddc22db))
* wire per-context model/effort to callers ([7468750](https://github.com/e0ipso/ai-knowledge-base/commit/7468750a1b5cd7ff3373f31f064b9644bba543eb))

### Bug Fixes

* **curate:** explain malformed JSON failures ([536f161](https://github.com/e0ipso/ai-knowledge-base/commit/536f1611bd671368d79b2d6306c02a7aa23ccb80))
* fail loud on invalid KB node frontmatter ([621afe0](https://github.com/e0ipso/ai-knowledge-base/commit/621afe0de3c536083f96f66d0cb8ef391c252522))
* on file per session ([e262292](https://github.com/e0ipso/ai-knowledge-base/commit/e2622927ca8c0666e90be4211c1da6d386a7fede))
* quote ISO timestamps in kb skill examples ([58f547b](https://github.com/e0ipso/ai-knowledge-base/commit/58f547be6ea28398f2c803384137e4f48d5f9a35))

## [1.1.0](https://github.com/e0ipso/ai-knowledge-base/compare/v1.0.0...v1.1.0) (2026-05-12)

### Features

* setup task manager and kb ([44e76b3](https://github.com/e0ipso/ai-knowledge-base/commit/44e76b3e3eaef774672e19b155028c5293d56bc0))
* use lintstaged ([eaf40f2](https://github.com/e0ipso/ai-knowledge-base/commit/eaf40f2ab8128dd01d1a028dfcb867c86a62659b))

### Bug Fixes

* make config.yaml not JSON ([e38feae](https://github.com/e0ipso/ai-knowledge-base/commit/e38feaeede0db11d38f4a9d91918c22b5f228592))

## [1.0.0](https://github.com/e0ipso/ai-knowledge-base/compare/v0.2.0...v1.0.0) (2026-05-12)

### ⚠ BREAKING CHANGES

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

* drop _proposed/, write nodes/ directly ([2692fe6](https://github.com/e0ipso/ai-knowledge-base/commit/2692fe69b37f75468b947713d19c8b1ae7ba4590))

## Unreleased

### BREAKING CHANGES

* The `_proposed/` directory and the `proposal:` frontmatter block have been removed. Skills, the curator, manual `node add`, and bootstrap all write directly to `nodes/<kind>/<id>.md`. Acceptance is `git commit`; rejection is `git restore <path>`. Existing repositories with a populated `_proposed/` directory must hand-promote any in-flight proposals into `nodes/` (strip the `proposal:` block, move the file) and then delete the `_proposed/` directory before upgrading.
* `BootstrapDocEntrySchema.produced_proposals` renamed to `produced_nodes`. Entries are bare `<kind>/<filename>.md` paths relative to `nodes/`.
* `CurateResult.proposalsWritten` renamed to `nodesWritten`. New fields `failures: FailureReport[]` and `conflicts: ConflictReport[]` carry per-action outcomes.
* `init` writes `.lintstagedrc.cjs` and no longer adds a `lint-staged` block to `package.json`.

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
