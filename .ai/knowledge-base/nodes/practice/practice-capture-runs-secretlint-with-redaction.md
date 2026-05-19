---
schema_version: 1
id: practice-capture-runs-secretlint-with-redaction
title: "Capture runs secretlint and aborts on loader failure"
kind: practice
tags: [secretlint, capture, security, redaction]
derived_from:
  - docs/internals/hooks.md
  - docs/installation.md
  - CONTRIBUTING.md
relates_to:
  - map-capture-hook
depends_on: []
confidence: high
summary: "kb-capture.mjs runs secretlint (recommended preset) on the transcript and replaces findings with [REDACTED:<ruleId>]. If secretlint can't load, capture aborts."
---

# Capture runs secretlint and aborts on loader failure

`kb-capture.mjs` runs [secretlint](https://github.com/secretlint/secretlint) with the recommended preset on the role-tagged transcript before writing it to `_sessions/`. Findings are replaced with `[REDACTED:<ruleId>]`. If secretlint fails to load or times out, capture **aborts** — no session log is written.

**Why:** the session log will be read by an LLM (the proposal-extract pipeline) and stored in `_sessions/`/`_logs/`, which are gitignored but still on disk. Writing a transcript that may contain unredacted secrets defeats the safety story. Failing closed (no log) is preferred over failing open (log with possibly-unredacted secrets); the next trigger retries.

**How to apply:**

- The package only handles **capture-time** redaction; commit-time secret scanning is the consumer's responsibility (run secretlint in CI; see installation guide for the lint-staged path if you want local).
- Treat `_sessions/` and `_logs/` with the same care as the redacted transcript — secrets secretlint *missed* could still appear. Don't ship them outside the local machine.
- Do not weaken the loader-failure abort to "warn and continue"; failing closed is the load-bearing property here.
