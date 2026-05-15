---
schema_version: 1
id: practice-shared-skill-templates
title: "Shared SKILL.md source resolved at runtime"
kind: practice
tags: [skills, templates, harness]
derived_from: []
relates_to: [practice-explicit-harness-flag, map-opencode-harness-adapter, map-codex-harness-adapter, map-claude-skills]
confidence: high
summary: "One SKILL.md source per skill ships identical bytes to every configured harness; --harness resolves at runtime via /tmp/kb-detect-harness.mjs."
---

# Shared SKILL.md source resolved at runtime

There is one source per skill at `src/templates-source/skills/kb-{add,bootstrap,curate}/SKILL.md`. The installer copies the same bytes into every configured harness's native skills directory (`.claude/skills/`, `.agents/skills/`, `.opencode/skills/`). Per-harness skill source trees do not exist.

## Why

Per-harness SKILL.md duplication multiplied with every new adapter (Claude, Codex, OpenCode, ...) and differed only in the literal `--harness <id>` string baked into the prose. The duplication is the maintenance hot spot every adapter touches; a shared source removes it without sacrificing the explicit-flag rule from [[practice-explicit-harness-flag]].

## How to apply

- Author skill bodies in a single SKILL.md per skill under `src/templates-source/skills/kb-<name>/SKILL.md`.
- Each body opens with a heredoc that lazy-writes `/tmp/kb-detect-harness.mjs` and runs it to resolve the active harness id. The LLM authoring the body substitutes its own best-guess id for the `<hint>` placeholder; the helper validates it against the registered ids, walks env / `cliDefaultHarness` on misses, and prints the resolved id to stdout.
- Every CLI invocation in the body passes `--harness "$HARNESS"`.
- The shared installer (`src/lib/install-skills.ts`) drops the bytes into each adapter's `paths.skillsDir` from the same source. Adapter `install.ts` files call the helper; they do not maintain per-harness skill source trees.

## Trade-offs

The Claude `allowed-tools` frontmatter field is gone from the shared body because every other harness ignores it. Claude users wanting pre-approval ergonomics add `Bash(npx @e0ipso/ai-knowledge-base:*)` to `.claude/settings.json` once; the equivalent permission story is one line per project instead of one line per skill.

## CI guardrail

The detect script's env-detector list and registered-id list are mirrored from the TS resolver in `src/harnesses/detect.ts`. A CI lint (`scripts/lint-detect-harness.mjs`, invoked by `npm run lint:detect-harness`) extracts both sides and exits non-zero on drift. Adding a new harness updates two locations (the TS adapter source AND the heredoc); the lint catches divergence.

See also [[map-opencode-harness-adapter]] for the adapter whose plugin-shaped extension surface motivated the consolidation, and [[map-claude-skills]] for the Claude skills location.
