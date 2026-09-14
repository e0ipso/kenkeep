---
title: Hooks
parent: Internals
nav_order: 2
redirect_from:
  - /internals/kk-navigation.html
---

# Hooks

A hook is a script the host assistant runs on one of its lifecycle events. Kenkeep registers into those events and exposes no hook API of its own.

`init` compiles the scripts into `.ai/kenkeep/hooks/<harness>/` and registers them the host's way. Claude Code is the reference wiring:

| Script | Events | Mode |
|---|---|---|
| `kk-capture.cjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, 1 s deadline |
| `kk-session-start.cjs` | `SessionStart` | sync, 1 s deadline |
| `kk-prompt-context.cjs` | `UserPromptSubmit` | sync, 1 s deadline. Claude Code and Codex only |
| `kk-proposal-drain.cjs` | `SessionStart` | async |
| `kk-lint-tick.cjs` | `SessionEnd` | async, every `lintEveryNSessions` |

Event names differ per host, but the roles are the same. Every hook exits 0. Swallowed failures go to `_logs/hook-errors-YYYY-MM-DD.log`, one JSON line each.

## Sync or async

A hook that hands data back to the host must stay synchronous, because the host discards an async hook's stdout. That covers capture, session-start, and prompt-context. Drain and lint-tick run in the background.

Claude Code has native `async: true` and OpenCode dispatches through its plugin. Codex, Cursor, and Copilot have no async hooks, so there the worker goes through `src/lib/async-launcher.ts`: read stdin with a 250 ms cap, re-spawn as a detached child in its own process group, exit. A timeout kill aimed at the parent cannot reach the worker. The launcher offers no output, no retry, and no ordering.

## Recursion guard

Every hook exits at once when `KENKEEP_BUILDER_INTERNAL=1` is set. The drain sets it on its headless child, and the launchers set it on the session they exec. Without it, the spawned session would fire its own `SessionStart` hooks and recurse.

{% include callout.html variant="warning" content="If you wrap an assistant CLI, propagate `KENKEEP_BUILDER_INTERNAL=1` only into subprocesses you mean to be internal. Leaking it elsewhere silently disables capture and injection." %}

## Capture

Reads the payload from stdin, validates `session_id` (UUID v4 on most hosts, any UUID shape on Codex), parses the transcript into role-tagged turns, strips `<kk-private>` spans, and writes `_sessions/<YYYYMMDD-HHmm-sessionId>.md`. A re-fire for the same session reuses the file. Empty input or a missed deadline exits silently, and the next trigger retries.

{% include callout.html variant="warning" content="Capture does not scan or redact. Secrets said in a session land verbatim in `_sessions/`, which is gitignored. Hygiene on committed notes is yours. See [commit-time hardening](../installation.md#commit-time-hardening-optional)." %}

## Proposal drain

On `SessionStart`: take the lock, load the prompt (local override first), sweep `_sessions/` for `proposal_status: pending`, and run the host's headless driver once per log with the stream saved to `_logs/proposal/`. A result that validates flips the log to `done` with its candidates. Anything else flips it to `failed`, and failures are not retried because they do not heal by themselves. Set the status back to `pending` to retry by hand.

## Session start

1. Load `ENTRY.md`, the branch catalog, never the whole base. If it is missing, inject `_The knowledge base is empty._`.
2. Append the navigation directive from `KK_NAVIGATION_DIRECTIVE` in `src/lib/session-start.ts`: read the root, pick the branches whose intent and tags match the task, read their `index.md`, open only confirmed-relevant leaves, follow cross edges. `AGENTS.md` reuses the same constant.
3. Compare the catalog's `nodes_hash` with the live tree and warn on drift.
4. Count the curation queue. At `curationThreshold`, at most hourly, append the nudge. Escalate at twice the threshold or when the oldest capture is `staleDays` (7) old.
5. Append a freshness line under a hard git-call budget, or nothing when git is unavailable.
6. Fire one desktop notification for actionable nudges when a local backend exists.
7. Emit through the host channel: `additionalContext` on Claude Code and Codex, `additional_context` on Cursor, a rewritten `.opencode/AGENTS.md` on OpenCode, the sentinel block in `.github/copilot-instructions.md` on Copilot.

The directive lives only in this payload because `SessionStart` is the one place every session reads without opening a file first.

## Prompt-time injection

Session start fires before any task is known, so it can only orient. On Claude Code and Codex a second hook fires on `UserPromptSubmit`, scores every leaf against the prompt (title, tags, and description weighted above body, plus a small neighbor boost), and injects a bounded block of summaries and links, never full bodies. No LLM, no embeddings, no persistent state, and the prompt text is never logged. On any error it injects nothing and the prompt goes through untouched. The other hosts have no verified prompt-context channel and register no such hook.
