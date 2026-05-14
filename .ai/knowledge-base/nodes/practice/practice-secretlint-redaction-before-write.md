---
schema_version: 1
id: practice-secretlint-redaction-before-write
title: "Secretlint redacts every session transcript before write"
kind: practice
tags: [security, secrets, capture]
derived_from:
  - PRD.md
  - docs/internals/hooks.md
  - docs/installation.md
relates_to: []
confidence: high
summary: "kb-capture runs secretlint with the recommended preset before writing the session log; aborts on scanner failure."
---

# Secretlint redacts every session transcript before write

Two passes of secret scanning:

1. **In `kb-capture.mjs`** (every `Stop`/`SessionEnd`/`PreCompact`): secretlint runs with `@secretlint/secretlint-rule-preset-recommend` over the redacted transcript. Findings are replaced inline with `[REDACTED:<ruleId>]`. If secretlint fails to load or times out, capture aborts and no session log is written.
2. **At commit time**: a husky `pre-commit` hook runs `lint-staged`, which runs the same secretlint preset on staged files. Both are installed by `init`.

**Why:** "Zero secret incidents" is an explicit success criterion in the PRD. No secrets, API keys, customer data, or other sensitive content should ever land in the KB or in committed files.

**How to apply:**

- Never bypass either pass. If secretlint blocks a commit, fix the file; do not `--no-verify`.
- The capture hook *aborts the write* if the scanner crashes; this is intentional. Better to lose the session log than risk leaking.
- `_logs/` and `_sessions/` are both gitignored by default. Treat them with the same care: secretlint redacts what it catches, but secrets it misses could still appear.
