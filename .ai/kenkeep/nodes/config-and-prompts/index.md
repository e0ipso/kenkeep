---
schema_version: 2
nodes_hash: 'sha256:5026019c4ca053c15fd6a5e59e36408f94b322e03fa3ce85c6ad7184fb0d8e66'
node_count: 4
summary: >-
  config.yaml project settings and the prompt templates, their versioning, and
  local overrides
---
# kenkeep Index: config-and-prompts

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) to learn about: Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert. #prompts #customization #override
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) to learn about: Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples. #documentation #harness #models #recommendations #examples #configuration
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) to learn about: Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent. #prompts #versioning #audit

## Components (what exists)
- Open [**config.yaml (project settings)**](config-and-prompts/map-config-yaml.md) to learn about: Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error. #config #settings #model

## By topic

### #prompts
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Curator drops non-productive and change-oriented candidates**](curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
### #audit
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
### #config
- Open [**config.yaml (project settings)**](config-and-prompts/map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #configuration
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #customization
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
### #documentation
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #examples
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #harness
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
### #model
- Open [**config.yaml (project settings)**](config-and-prompts/map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #models
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #override
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
### #recommendations
- Open [**Avoid harness favoritism in examples and recommendations**](config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #settings
- Open [**config.yaml (project settings)**](config-and-prompts/map-config-yaml.md) — Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys are a hard error.
### #versioning
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Strict schema-version bump policy**](node-schema/practice-strict-schema-version-bump-policy.md) — On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised \`migrate\` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized.
