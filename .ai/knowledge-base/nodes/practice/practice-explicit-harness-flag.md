---
schema_version: 1
id: practice-explicit-harness-flag
title: "Every CLI invocation passes `--harness <id>` explicitly"
kind: practice
tags: [cli, invocation, harness]
derived_from: []
relates_to: [practice-cli-invocations-use-npx-scoped, practice-shared-skill-templates, map-codex-harness-adapter, map-opencode-harness-adapter, map-adapter-interface]
confidence: high
summary: "Every CLI invocation from a skill, hook, or doc must pass `--harness <id>` explicitly; skills resolve the value at runtime via `/tmp/kb-detect-harness.mjs`."
---

# Every CLI invocation passes `--harness <id>` explicitly

Every user-facing invocation of `npx @e0ipso/ai-knowledge-base ...` from a skill body, a hook script, or documentation must carry an explicit `--harness <id>` flag (one of `claude`, `codex`, `opencode`). The flag is the contract between the caller and the CLI process; it tells the CLI which adapter to dispatch to without relying on environment inference.

## Rationale

Claude Code sets distinctive env vars (`CLAUDECODE`, `CLAUDE_PROJECT_DIR`) that runtime detection can key off. Codex and OpenCode offer no equivalent: a Codex or OpenCode session and a plain shell invocation look identical to the CLI from the inside. The only robust signal is the flag the calling skill or hook puts on the command line.

Treating `--harness <id>` as required everywhere (not "Codex-only" or "OpenCode-only") keeps the contract uniform: every emitter passes the flag, the CLI never has to guess.

## Mechanism

Skills do not hardcode the id. They share one SKILL.md source per skill (see [[practice-shared-skill-templates]]) and resolve the active harness at runtime via a tiny `/tmp/kb-detect-harness.mjs` helper. Each SKILL.md body opens with a heredoc that lazy-writes the script on first invocation, then invokes it:

```bash
HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <claude|codex|opencode>)
npx @e0ipso/ai-knowledge-base curate --harness "$HARNESS"
```

The LLM authoring the skill body substitutes its own best-guess id for the `<hint>` placeholder. The script validates the hint, walks the env / `cliDefaultHarness` chain on misses, and prints the resolved id to stdout.

## Priority

The detect script mirrors `resolveWithHint` in `src/harnesses/detect.ts`:

1. Hint, when valid: hint wins (so an explicit `--hint opencode` from inside an OpenCode session reaches the right adapter even if `CLAUDECODE=1` leaks in from the parent shell).
2. Env detection: each adapter's `detectFromEnv` in registry order; first truthy match wins. Currently Claude only.
3. `cliDefaultHarness` from `.ai/knowledge-base/config.yaml`, when valid.
4. Exit non-zero with a message directing the user to set `--hint` or `cliDefaultHarness`.

A CI lint (`npm run lint:detect-harness`) fails the build when the heredoc env-var list and the TS resolver list disagree.

## How to apply

- Every code path that emits a CLI command for a user (skill body, hook script, doc example, troubleshooting snippet) carries `--harness <id>`.
- Skills emit `--harness "$HARNESS"` after resolving via the detect script; hook scripts hardcode the value because they are per-harness.
- Tests assert that generated skill files contain the detect-harness recipe and pass `--harness "$HARNESS"` to every CLI call.

## Out of scope

Internal subprocess fan-out spawned by the CLI itself (inside `bootstrap-incremental` or `curate`) does not need the flag on its internal command lines, because the parent process already knows the harness and passes context through other channels. The rule targets the surface that humans and harness sessions actually type or template into prose.

See also [[practice-cli-invocations-use-npx-scoped]] for the broader rule that all invocations use the scoped `npx` form, [[practice-shared-skill-templates]] for the single-source skill convention this rule lives inside, and [[map-codex-harness-adapter]] / [[map-opencode-harness-adapter]] for the adapters that motivated mandatory explicit selection.
