# kenkeep Index: conventions / development

↑ Parent: [conventions](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Harness directories are vendored or dogfooded, never source**](practice-harness-dirs-are-vendored-or-dogfooded-not-source.md) to learn about: Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold vendored or dogfooded artifacts, not source. #harnesses #dogfooding #vendored #build #source-of-truth #code-review
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) to learn about: This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned. #testing #philosophy #integration-tests #coverage
- Open [**Ignore harness JavaScript artifacts in Prettier**](practice-ignore-harness-javascript-artifacts-in-prettier.md) to learn about: Prettier ignores JavaScript-family files under harness and agent folders, including CJS and MJS bundles. #prettier #harnesses #formatting
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) to learn about: kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility. #security #secrets #capture #documentation
- Open [**Distinguish Kenkeep development tooling from the Kenkeep product**](practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product.md) to learn about: Installed development tools and their lockfiles do not define Kenkeep's product behavior or distribution contract. #dogfooding #development #source-of-truth #distribution
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) to learn about: Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the principle, not today's files. #yagni #assumptions #verification

## Components (what exists)
_None yet._

## By topic

### #dogfooding
- Open [**Harness directories are vendored or dogfooded, never source**](practice-harness-dirs-are-vendored-or-dogfooded-not-source.md) — Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold vendored or dogfooded artifacts, not source.
- Open [**Distinguish Kenkeep development tooling from the Kenkeep product**](practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product.md) — Installed development tools and their lockfiles do not define Kenkeep's product behavior or distribution contract.
### #harnesses
- Open [**Ignore harness JavaScript artifacts in Prettier**](practice-ignore-harness-javascript-artifacts-in-prettier.md) — Prettier ignores JavaScript-family files under harness and agent folders, including CJS and MJS bundles.
- Open [**Add hermetic end-to-end capture tests per harness**](../../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
- Open [**Cross-harness features must use adapter-level abstractions**](../../harnesses/cross-harness/practice-cross-harness-features-must-use-adapter-level-abstractions.md) — For features spanning all harnesses, build adapter-level abstractions that work everywhere rather than assuming Claude's shape is universal.
### #source-of-truth
- Open [**Harness directories are vendored or dogfooded, never source**](practice-harness-dirs-are-vendored-or-dogfooded-not-source.md) — Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold vendored or dogfooded artifacts, not source.
- Open [**Distinguish Kenkeep development tooling from the Kenkeep product**](practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product.md) — Installed development tools and their lockfiles do not define Kenkeep's product behavior or distribution contract.
### #assumptions
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the principle, not today's files.
### #build
- Open [**Keep template partials out of the knowledge base**](../../config-and-prompts/practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
- Open [**Keep template partials out of the knowledge base**](../../practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](../../hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
### #capture
- Open [**kk-capture.mjs (capture hook)**](../../hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Usage ledger depends on successful capture**](../../state/map-usage-ledger-depends-on-successful-capture.md) — usage.jsonl records node reads only from sessions whose capture hook persists usage rows.
- Open [**Add hermetic end-to-end capture tests per harness**](../../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #code-review
- Open [**Harness directories are vendored or dogfooded, never source**](practice-harness-dirs-are-vendored-or-dogfooded-not-source.md) — Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold vendored or dogfooded artifacts, not source.
### #coverage
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #development
- Open [**Distinguish Kenkeep development tooling from the Kenkeep product**](practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product.md) — Installed development tools and their lockfiles do not define Kenkeep's product behavior or distribution contract.
### #distribution
- Open [**Distinguish Kenkeep development tooling from the Kenkeep product**](practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product.md) — Installed development tools and their lockfiles do not define Kenkeep's product behavior or distribution contract.
### #documentation
- Open [**Skills-first documentation, only init is CLI**](../../cli/practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
- Open [**Avoid harness favoritism in examples and recommendations**](../../config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #formatting
- Open [**Ignore harness JavaScript artifacts in Prettier**](practice-ignore-harness-javascript-artifacts-in-prettier.md) — Prettier ignores JavaScript-family files under harness and agent folders, including CJS and MJS bundles.
### #integration-tests
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #philosophy
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
### #prettier
- Open [**Ignore harness JavaScript artifacts in Prettier**](practice-ignore-harness-javascript-artifacts-in-prettier.md) — Prettier ignores JavaScript-family files under harness and agent folders, including CJS and MJS bundles.
### #secrets
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
### #security
- Open [**Consumers are responsible for secret hygiene**](practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](../../index/practice-determinism-contract.md) — computeNodesHash, generateIndex/Graph, slugify, deriveNodeId, ensureUniqueId are pure; only crypto.randomUUID() (run_id) is random.
- Open [**Testing philosophy: few tests, mostly integration**](practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
- Open [**Add hermetic end-to-end capture tests per harness**](../../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #vendored
- Open [**Harness directories are vendored or dogfooded, never source**](practice-harness-dirs-are-vendored-or-dogfooded-not-source.md) — Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold vendored or dogfooded artifacts, not source.
### #verification
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the principle, not today's files.
### #yagni
- Open [**Do not justify scope decisions by current-snapshot file contents**](practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md) — Claims like 'that folder only contains code' are snapshot observations, not guarantees; decide scope from the principle, not today's files.