---
schema_version: 1
id: practice-init-does-not-install-commit-tooling
title: "init does not install husky/lint-staged/secretlint/commitlint"
kind: practice
tags: [init, install, scope]
derived_from:
  - docs/installation.md
  - docs/cli-reference.md
relates_to:
  - practice-capture-runs-secretlint-with-redaction
  - practice-pre-commit-stages-index-graph
depends_on: []
confidence: high
summary: "init writes the KB scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility."
---

# `init` does not install husky / lint-staged / secretlint / commitlint

`init` writes:

- `.ai/knowledge-base/` — KB scaffold.
- The harness's hooks and skills (`.claude/`, `.codex/`, `.opencode/`).
- A managed block in the repo `.gitignore` for runtime state files.

It does **not** install or patch husky, lint-staged, secretlint, or commitlint. It also does not patch the project `package.json` — a `package.json` at the repo root is no longer required at all.

**Why:** commit-time tooling is opinionated and project-specific. Imposing it would either conflict with an existing setup or wire something the consumer didn't ask for. The package only owns the redaction inside `kb-capture.mjs` (which loads `secretlint` programmatically from `node_modules` if present) and the lint-staged-friendly `index rebuild --stage` subcommand for consumers who do choose to wire pre-commit.

**How to apply:**

- Don't claim or imply `init` brings these. The installation doc walks consumers through opt-in setup.
- Capture-time redaction is the only protection the package guarantees; CI-time `secretlint` (or local pre-commit secretlint) is the consumer's job. See `docs/installation.md` for the recipe.
