---
schema_version: 2
nodes_hash: 'sha256:e4c2d65d9742ff3042ec52496c182f5b9f90da5ef153577feae2103986120356'
node_count: 8
summary: >-
  commit, release, testing, CI, and writing-style rules; read before committing,
  releasing, or writing docs
---
# kenkeep Index: conventions

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) to learn about: Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output. #ci #llm #workflow
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) to learn about: This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned. #testing #philosophy #integration-tests #coverage
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) to learn about: kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility. #security #secrets #capture #documentation
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) to learn about: Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish. #git #release #conventional-commits
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) to learn about: Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today. #yagni #assumptions #verification
- Open [**Never force push**](practice-never-force-push.md) to learn about: Force pushing rewrites remote history and can lose collaborators' work. #git #conventions
- Open [**No em dashes anywhere in the project**](practice-no-em-dashes.md) to learn about: Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead. #style #writing #ai-detection
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) to learn about: All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output. #review #git #workflow

## Components (what exists)
_None yet._

## By topic

### #git
- Open [**Never force push**](practice-never-force-push.md) — Force pushing rewrites remote history and can lose collaborators' work.
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #workflow
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #ai-detection
- Open [**No em dashes anywhere in the project**](practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #assumptions
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
### #capture
- Open [**kk-capture.mjs (capture hook)**](../hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Add hermetic end-to-end capture tests per harness**](../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
- Open [**Session log (_sessions/*.md)**](../state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #ci
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
### #conventional-commits
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
### #conventions
- Open [**Never force push**](practice-never-force-push.md) — Force pushing rewrites remote history and can lose collaborators' work.
### #coverage
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #documentation
- Open [**Skills-first documentation, only init is CLI**](../cli/practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
- Open [**Avoid harness favoritism in examples and recommendations**](../config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #integration-tests
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #llm
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**LLM-backed migrations require explicit --harness flag**](../harnesses/practice-llm-backed-migrations-require-explicit-harness-flag.md) — Migrations that cluster nodes with an LLM must fail fast if the user did not pass --harness explicitly.
- Open [**kk-proposal-drain (extraction hook)**](../hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
### #philosophy
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #release
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
### #review
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #secrets
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
### #security
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
### #style
- Open [**No em dashes anywhere in the project**](practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](../index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
- Open [**Add hermetic end-to-end capture tests per harness**](../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #verification
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
### #writing
- Open [**No em dashes anywhere in the project**](practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #yagni
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
