---
schema_version: 2
nodes_hash: 'sha256:f8a238ac9644b8bffcf3fb9b08eb4dcfbd3f844b86ee4c3a86b25b6163495d99'
node_count: 6
summary: >-
  project-wide conventions for commits, releases, testing, CI, writing style,
  and reviewing nodes via git
---
# kenkeep Index: conventions

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Don't run curate or bootstrap-incremental in CI**](conventions/practice-dont-run-llm-pipelines-in-ci.md) to learn about: Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output. #ci #llm #workflow
- Open [**Conventional Commits drive semantic-release**](conventions/practice-conventional-commits-and-release.md) to learn about: Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish. #git #release #conventional-commits
- Open [**Do not justify scope decisions by current-snapshot file contents**](conventions/practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) to learn about: Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today. #yagni #assumptions #verification
- Open [**No em dashes anywhere in the project**](conventions/practice-no-em-dashes.md) to learn about: Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead. #style #writing #ai-detection
- Open [**Review node changes via git**](conventions/practice-review-nodes-via-git.md) to learn about: All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output. #review #git #workflow
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) to learn about: This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned. #testing #philosophy #integration-tests #coverage

## Components (what exists)
_None yet._

## By topic

### #git
- Open [**Conventional Commits drive semantic-release**](conventions/practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
- Open [**Review node changes via git**](conventions/practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #workflow
- Open [**Don't run curate or bootstrap-incremental in CI**](conventions/practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**Review node changes via git**](conventions/practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #ai-detection
- Open [**No em dashes anywhere in the project**](conventions/practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #assumptions
- Open [**Do not justify scope decisions by current-snapshot file contents**](conventions/practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
### #ci
- Open [**Don't run curate or bootstrap-incremental in CI**](conventions/practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
### #conventional-commits
- Open [**Conventional Commits drive semantic-release**](conventions/practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
### #coverage
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #integration-tests
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #llm
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
- Open [**Don't run curate or bootstrap-incremental in CI**](conventions/practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
### #philosophy
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #release
- Open [**Conventional Commits drive semantic-release**](conventions/practice-conventional-commits-and-release.md) — Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish.
### #review
- Open [**Review node changes via git**](conventions/practice-review-nodes-via-git.md) — All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output.
### #style
- Open [**No em dashes anywhere in the project**](conventions/practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #verification
- Open [**Do not justify scope decisions by current-snapshot file contents**](conventions/practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
### #writing
- Open [**No em dashes anywhere in the project**](conventions/practice-no-em-dashes.md) — Prohibit em dashes in all files to avoid patterns that signal AI-generated text. Restructure with commas or periods instead.
### #yagni
- Open [**Do not justify scope decisions by current-snapshot file contents**](conventions/practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the underlying principle, not from what files happen to exist today.
