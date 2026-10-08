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
| `kk-capture.cjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, 1 s cooperative budget (OpenCode: 8 s) |
| `kk-session-start.cjs` | `SessionStart` | sync, 1 s cooperative budget; always injects the entry catalog, skips the staleness and freshness checks when the budget runs out |
| `kk-prompt-context.cjs` | `UserPromptSubmit` | sync, 1 s cooperative budget. Claude Code and Codex only |
| `kk-proposal-drain.cjs` | `SessionStart` | async |
| `kk-lint-tick.cjs` | `SessionEnd` | async, every `lintEveryNSessions` |

Event names differ per host, but the roles are the same. Every hook exits 0. Swallowed failures go to `_logs/hook-errors-YYYY-MM-DD.log`, one JSON line each.

## Hook budgets

A hook's deadline is cooperative, not a hard kill. Node cannot interrupt synchronous work, so the timer in `src/lib/hook-entry.ts` fires only while the hook is awaiting something. Each hook gets a `HookBudget` (`deadlineAt`, `remainingMs()`) and checks it between bounded units: per directory and per leaf in retrieval and in the SessionStart staleness hash and freshness probe, per child timeout in OpenCode capture. The timer is cleared when the hook finishes, so a hook that completed never logs a deadline after the fact. One unbounded unit, such as parsing a single large leaf or a `spawnSync` with no timeout of its own, can still overrun.

The prompt-time hook was measured against a slow filesystem: 12 leaves, each read stalled 200 ms, a 1 s deadline. It finished in 1,348 to 1,371 ms and injected nothing, with one `budget` line in the error log. The bound to plan for is the budget, plus one stalled unit, plus about 600 ms of process start and teardown, here 1.8 s. Its output obeys the rendered-character budget exactly, trailing newline included. When one entry would overflow, the first entry's summary is truncated with an ellipsis.

SessionStart always injects the entry catalog, the curation queue and the lint state. The node walks behind the staleness hash and the freshness probe check the budget before each leaf and give up once it is spent. A walk that gives up reports no signal, so the hook shows no stale warning and no freshness line instead of guessing from a partial walk. Nothing goes to the error log for this. Once its walk finishes, the freshness probe still runs one `git log` capped at 500 commits.

OpenCode capture runs with 8 s. Its `opencode export` probe and export timeouts are carved out of what is left of that budget, so the synchronous spawn cannot outlive the deadline. If the export times out, the hook skips the capture and writes no log.

## Sync or async

A hook that hands data back to the host must stay synchronous, because the host discards an async hook's stdout. That covers capture, session-start, and prompt-context. Drain and lint-tick run in the background.

Claude Code has native `async: true` and OpenCode dispatches through its plugin. Codex, Cursor, and Copilot have no async hooks, so there the worker goes through `src/lib/async-launcher.ts`: read stdin with a 250 ms cap, re-spawn as a detached child in its own process group, exit. A timeout kill aimed at the parent cannot reach the worker. The launcher offers no output, no retry, and no ordering.

## Recursion guard

Every hook exits at once when `KENKEEP_BUILDER_INTERNAL=1` is set. The drain sets it on its headless child, and the launchers set it on the session they exec. Without it, the spawned session would fire its own `SessionStart` hooks and recurse.

{% include callout.html variant="warning" content="If you wrap an assistant CLI, propagate `KENKEEP_BUILDER_INTERNAL=1` only into subprocesses you mean to be internal. Leaking it elsewhere silently disables capture and injection." %}

## Capture

Reads the payload from stdin, validates `session_id` (UUID v4 on most hosts, any UUID shape on Codex), parses the transcript into role-tagged turns, strips `<kk-private>` spans, and writes `_sessions/<YYYYMMDD-HHmm-sessionId>.md` atomically. A re-fire for the same session reuses the file. Empty input or a missed deadline exits silently, and the next trigger retries.

The status line each adapter prints comes from the capture result. "Saved" appears only for a written log, a skip names its reason, and a pipeline error prints "capture error". Claude Code's `systemMessage` is emitted only when a log was written.

OpenCode's `session.idle` payload has no transcript path, so its hook runs `opencode export <sessionID>`. The CLI does not flush a pipe, so the export goes to a file in a private `mkdtemp` directory that is removed on every exit path, including the cooperative deadline. No `kk-opencode-*` directory remains, kenkeep writes no copy of its own, and the session log is written only after private spans are stripped.

### Transcript versions

Every log names its transcript version: `transcript_hash` (sha256 over the rendered transcript) and `transcript_chars` (its length). Extraction and curation bind to that version, which is what keeps repeated hook fires, long sessions and concurrent extraction consistent:

- A re-fire whose transcript hashes the same as the stored one (a duplicate Stop/SessionEnd, no new turns) leaves the file untouched, so a `done`/`failed` extraction and its proposals survive.
- A changed transcript is a new version: the log goes back to `pending` with empty proposals.
- A curate run stamps the version it consumed (`curator_processed_at`, `curator_run_id`, `curated_transcript_hash`, `curated_transcript_chars`). When the session keeps going, capture keeps the stamp and, if the consumed version is still a prefix of the new transcript (hash of the first `curated_transcript_chars` characters matches), renders those turns under `## Curated prefix` and only the new turns under `## Transcript`. Extraction reads `## Transcript` alone, so curated knowledge is normally not proposed twice. The exception is a capture that lands while a curate run is stamping the log: that capture rendered the whole transcript under `## Transcript`, the stamp does not re-render it, and an identical recapture leaves the file alone, so the next run may extract those turns again and the curator reconciles them against existing nodes. A transcript that is no longer a prefix extension (compaction, rewrite, a `/kk-session-extract` excerpt) is re-extracted whole and the curator reconciles it against existing nodes.
- A session is consumable by `curate-dedup` when it is `done` and either unstamped or stamped for an older `transcript_hash`; `curate-dedup` refuses to stamp a session whose hash moved since its batch draft recorded it. A stamp without `curated_transcript_hash` (written before version binding) is never re-admitted.
- Write-back is version-checked: the drain and `session-log update-proposals --expected-hash` re-read the log immediately before writing and refuse when the hash changed, leaving the newer version pending.

These fields are additive, so session logs keep `schema_version: 1`.

{% include callout.html variant="warning" content="Capture does not scan or redact. Secrets said in a session land verbatim in `_sessions/`, which is gitignored. Hygiene on committed notes is yours. See [commit-time hardening](../installation.md#commit-time-hardening-optional)." %}

## Proposal drain

On `SessionStart`: take the lock, load the prompt (local override first), sweep `_sessions/` for `proposal_status: pending`, and run the host's headless driver once per log with the stream saved to `_logs/proposal/`. A result that validates flips the log to `done` with its candidates. Anything else flips it to `failed`, and failures are not retried because they do not heal by themselves. Set the status back to `pending` to retry by hand. If a capture rewrote the log while its extractor ran, the result is discarded (`stale`) and the newer version stays pending for the next drain.

## Session start

1. Load `ENTRY.md`, the branch catalog, never the whole base. If it is missing, inject `_The knowledge base is empty._`.
2. Append the navigation directive from `KK_NAVIGATION_DIRECTIVE` in `src/lib/session-start.ts`: read the root, pick the branches whose intent and tags match the task, read their `index.md`, open only confirmed-relevant leaves, follow cross edges. `AGENTS.md` reuses the same constant.
3. Compare the catalog's `nodes_hash` with the live tree and warn on drift.
4. Count the curation queue. A session counts when it is uncurated, or curated against an older transcript than it now has. At `curationThreshold`, and at most once an hour, append the nudge: the curation entry in the attention block, the desktop notification, and the response directive. Inside that hour the status line (`Curation queue: N session log(s) awaiting curation, M candidate(s).`) is still injected, and `last_nudged_at` stays untouched. A missing, unparseable or future timestamp never throttles. Escalate at twice the threshold or when the oldest capture is `staleDays` (7) old. The count reads only each log's frontmatter, never its body.
5. Append a freshness line under a hard git-call budget, or nothing when git is unavailable.
6. Fire one desktop notification for actionable nudges when a local backend exists.
7. Emit through the host channel: `hookSpecificOutput.additionalContext` on Claude Code and Codex, `additional_context` on Cursor, a top-level `additionalContext` on Copilot CLI, a rewritten `.opencode/AGENTS.md` on OpenCode. Copilot's tracked `.github/copilot-instructions.md` carries only a static pointer block written at install; the hook never writes it, so hostname and queue state stay out of the committed file. The `additionalContext` channel is documented in GitHub's hook reference and changelog (injected since Copilot CLI 1.0.11). It has not been run against a live Copilot CLI session, and Copilot CLI was not installed where this was written.

The directive lives only in this payload because `SessionStart` is the one place every session reads without opening a file first.

## Prompt-time injection

Session start fires before any task is known, so it can only orient. On Claude Code and Codex a second hook fires on `UserPromptSubmit`, scores every leaf against the prompt (title, tags, and description weighted above body, plus a small neighbor boost), and injects a bounded block of summaries and links, never full bodies. No LLM, no embeddings, no persistent state, and the prompt text is never logged. On any error, or once its 1 s budget is spent, it injects nothing and the prompt goes through untouched. The other hosts have no verified prompt-context channel and register no such hook.
