---
schema_version: 2
nodes_hash: 'sha256:78a5b9e88da2e2a7686a30603b71453bb84a1504def69a67488c5486ac979895'
node_count: 4
summary: >-
  config.yaml settings and the prompt templates with their versioning; read when
  adding a setting or touching a prompt
---
# kenkeep Index: config-and-prompts

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Bump the prompt's Version comment on every behavior change**](practice-bump-prompt-version-comment.md) to learn about: Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent. #prompts #versioning #audit
- Open [**Local prompt overrides fall back to bundled templates**](practice-local-prompt-overrides-fall-back-to-bundled.md) to learn about: Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert. #prompts #customization #override
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) to learn about: Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples. #documentation #harness #models #recommendations #examples #configuration

## Components (what exists)
- Open [**config.yaml (project settings)**](map-config-yaml.md) to learn about: Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error. #config #settings #model

## By topic

### #prompts
- Open [**Bump the prompt's Version comment on every behavior change**](practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Local prompt overrides fall back to bundled templates**](practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
- Open [**Curator drops non-productive and change-oriented candidates**](../curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
### #audit
- Open [**Bump the prompt's Version comment on every behavior change**](practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
### #config
- Open [**config.yaml (project settings)**](map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #configuration
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #customization
- Open [**Local prompt overrides fall back to bundled templates**](practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
### #documentation
- Open [**Skills-first documentation, only init is CLI**](../cli/practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Consumers are responsible for secret hygiene**](../conventions/practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #examples
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #harness
- Open [**Cursor harness adapter**](../harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts from agent-transcripts/; Read and ReadFile both count for usage.
- Open [**Codex CLI harness adapter**](../harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](../harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — The silent-drop bug existed ~May 2026 and was fixed by Cursor upstream. kenkeep now injects via additional_context AND the AGENTS.md sentinel as a belt-and-braces pair.
### #model
- Open [**config.yaml (project settings)**](map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #models
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #override
- Open [**Local prompt overrides fall back to bundled templates**](practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
### #recommendations
- Open [**Avoid harness favoritism in examples and recommendations**](practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #settings
- Open [**config.yaml (project settings)**](map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #versioning
- Open [**Strict schema-version bump policy**](../node-schema/practice-strict-schema-version-bump-policy.md) — On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised \`migrate\` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized.
- Open [**Bump the prompt's Version comment on every behavior change**](practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
