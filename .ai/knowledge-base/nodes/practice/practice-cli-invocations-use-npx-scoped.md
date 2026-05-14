---
schema_version: 1
id: practice-cli-invocations-use-npx-scoped
title: "All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`"
kind: practice
tags: [cli, invocation, npx, prompts]
derived_from: []
relates_to: [map-ai-knowledge-base-package, map-claude-skills]
confidence: high
summary: "Every user-facing CLI reference uses `npx @e0ipso/ai-knowledge-base <subcommand>`, including skill allowed-tools patterns, hint strings, and docs."
---

# All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`

Every user-facing reference to the CLI in this repo must be written as `npx @e0ipso/ai-knowledge-base <subcommand>`. That includes:

- Hint strings printed by commands (`init`, `doctor`, `status`, `curate`, `node add`, `logs prune`, `index rebuild`, `bootstrap-incremental`).
- The SessionStart hook nudge strings: stale index, pending sessions, lint summary, the empty-KB stub.
- Skill `SKILL.md` `description` text and the `allowed-tools` permission pattern (`Bash(npx @e0ipso/ai-knowledge-base <subcommand>:*)`).
- `README.md`, `PRD.md`, and everything under `docs/`.
- Template seed files under `src/templates-source/` (notably `knowledge-base/INDEX.md`, `knowledge-base/GRAPH.md`, `knowledge-base/README.md`, and `claude/skills/*/SKILL.md`).

## Rationale

The package is published as `@e0ipso/ai-knowledge-base`. The scoped npx form works whether or not the user has already installed the package as a devDependency, and it is unambiguous about provenance. Bare `ai-knowledge-base` only resolves once `node_modules/.bin` is populated. Unscoped `npx ai-knowledge-base` is less explicit and can clash with any other binary that registers the same name.

## Out of scope

Internal code comments (e.g. inside `src/lib/...`) and prompt-template `Used by:` headers describe the binary, not an invocation a human is meant to type, so they do not need the `npx @e0ipso/` prefix.
