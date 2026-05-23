---
title: CLI reference
nav_order: 5
---

# CLI reference

The `ai-knowledge-base` binary is available after install (or run via `npx`). The CLI is now split into two kinds of commands:

- **Launchers** (`bootstrap`, `curate`, `node add`) exec the matching skill in the active harness (`<harness> -p "/kb-<name>"`). The LLM runs in the host harness session, with the user's own model and prompt cache. No internal sub-agent fan-out.
- **Primitives** (`finddocs`, `node write`, `curate-dedup`, `index rebuild`, `lint`, `status`, `doctor`, `init`, `logs prune`) are deterministic, no-LLM helpers. Skills call them from prompts; users can call them directly from a shell or CI.

## `--harness <id>` (global)

Selects the adapter (`claude`, `codex`, `cursor`, `opencode`). Inherited by every subcommand. Auto-detected via `CLAUDECODE=1` (Claude) and `CURSOR_VERSION` (Cursor). Codex and OpenCode have no env var, so pass `--harness` explicitly or set `cliDefaultHarness` in `config.yaml`.

```sh
npx @e0ipso/ai-knowledge-base --harness codex doctor
```

## Launchers

Each launcher is a thin wrapper. Its only job is to exec the host harness in `-p` mode against the matching slash-command, with `KB_BUILDER_INTERNAL=1` set on the child so the spawned session's SessionStart hooks (capture, nudge) don't re-fire inside the nested context. One harness invocation per user invocation; the LLM call happens once, in the host harness.

### `bootstrap [--from <scope>]`

```
npx @e0ipso/ai-knowledge-base bootstrap [--from <scope>]
```

Execs `<harness> -p "/kb-bootstrap [--from <scope>]"`. The kb-bootstrap skill enumerates candidate docs via `finddocs`, reads them with the host's `Read` tool, drafts node bodies inline, persists via `node write` (which also folds the per-file SHA-256 entry into `bootstrap-state.json`), and finishes with `index rebuild`.

Scope is controlled by `.kbignore` at the repo root, plus the optional `--from <scope>` to narrow to a subdirectory. Existing nodes are never overwritten.

Exit codes: whatever the host harness returns. The launcher itself only fails on missing harness binary (exit 1).

#### `bootstrap-incremental` (deprecation alias)

`bootstrap-incremental` is registered as a deprecation alias for `bootstrap`. It accepts the same flags. The next release removes it. Update any scripts or CI invocations to call `bootstrap` directly.

### `curate`

```
npx @e0ipso/ai-knowledge-base curate
```

Execs `<harness> -p "/kb-curate"`. The kb-curate skill reads pending session logs in `captured_at` order, drafts curator proposals in-session, pipes the merged proposal set to `curate-dedup` for the deterministic dedup + conflict-id + stamp transaction, then runs `index rebuild`.

Do not run two `curate` invocations against the same repo concurrently — there is no cross-process lock, and the second invocation's `state.json`/session-stamp updates may silently lose to the first. See [Daily use → Curate](daily-use.md#curate).

### `node add`

```
npx @e0ipso/ai-knowledge-base node add
```

Execs `<harness> -p "/kb-add"`. The kb-add skill collects `kind`, `title`, `summary`, `body`, and `tags` conversationally, then persists via `node write`.

## Primitives

These commands never call the LLM and never spawn a harness. Skills compose them; CI / scripts can use them too.

### `finddocs [--from <scope>] [--with-hashes]`

Deterministically enumerate candidate markdown files for the KB. Applies `.gitignore`, `.kbignore`, and the built-in static-skip list. Read-only.

```
Usage: ai-knowledge-base finddocs [options]

Options:
  --from <scope>  narrow discovery to a subdirectory of the repo root
  --with-hashes   append a tab-separated SHA-256 hex digest to each line so
                  callers can compare against bootstrap-state.json (default: false)
```

Output: one line per surviving file, prefixed with `+ `, repo-root-relative. With `--with-hashes`, each line is `+ <relpath>\t<sha256-hex>`.

Example:

```sh
npx @e0ipso/ai-knowledge-base finddocs --from docs
# + docs/cli-reference.md
# + docs/daily-use.md
# + docs/how-it-works.md

npx @e0ipso/ai-knowledge-base finddocs --with-hashes
# + README.md	3f7c…
```

Exit codes: `0` always (an empty result still exits 0). Bad `--from` argument exits non-zero via Commander.

### `node write <kind> <slug> [flags]`

Headless primitive: atomically write a single node to `nodes/<kind>/<id>.md` with Zod-validated frontmatter and slug-collision resolution. Body read from stdin (default) or `--from <path>`. Prints the resolved `id` to stdout.

```
Usage: ai-knowledge-base node write [options] <kind> <slug>

Arguments:
  kind                    node kind: practice or map
  slug                    proposed id base (kind prefix added automatically when missing)

Options:
  --title <title>         short title (≤ 80 chars)
  --summary <summary>     one-line summary (≤ 140 chars)
  --tags <list>           comma-separated tags
  --relates-to <list>     comma-separated node ids
  --confidence <level>    low, medium, or high (default: high)
  --from <path>           read body from <path> instead of stdin
  --source-doc <relpath>  source markdown doc (repo-relative); requires --source-hash
  --source-hash <sha256>  sha256 hex digest of --source-doc; requires --source-doc
```

`--source-doc` and `--source-hash` must be passed together. When both are present, the same atomic transaction that writes the node also folds an entry into `bootstrap-state.json`'s per-file hash map — this is how the bootstrap skill marks a source doc as processed without a separate state-mark step.

Slug collisions are resolved by `ensureUniqueId` (`<id>-2`, `<id>-3`, …). The final id is printed to stdout for the caller to record.

Example (bootstrap skill, condensed):

```sh
echo "$BODY" | npx @e0ipso/ai-knowledge-base node write practice no-deep-imports \
  --title "Avoid deep relative imports" \
  --summary "Use the package alias instead of ../../../" \
  --tags "imports,style" \
  --source-doc docs/style.md \
  --source-hash 3f7c2a…
```

Exit codes: `0` on success, non-zero on Zod validation failure, slug-collision-after-resolution failure, or filesystem errors. Errors go to stderr.

### `curate-dedup [--input <path>]`

Deterministic curator-dedup primitive: validates a proposals JSON (from `--input <path>` or stdin against `CuratorOutputSchema`), dedups, mints `${runId}-${n}` conflict ids, writes conflict files under `conflicts/`, and stamps consumed session logs with `curator_processed_at` / `curator_run_id`. Pure Node — no LLM.

```
Usage: ai-knowledge-base curate-dedup [options]

Options:
  --input <path>          path to proposals JSON (CuratorOutputSchema); reads stdin when omitted
  --output <path>         write deduped surviving (non-conflict) actions to this JSON file
  --run-id <id>           caller-supplied run id (defaults to a fresh randomUUID)
  --sessions-dir <path>   override the _sessions directory (defaults to repo paths)
  --conflicts-dir <path>  override the conflicts directory (defaults to repo paths)
```

When `--output` is omitted, the surviving actions JSON is written to stdout so the caller can pipe it into a follow-up `node write` loop. `--run-id` exists for tests and for re-running a known batch; in normal use, omit it and let the primitive mint a UUID.

Atomic: conflict-file writes and session-log frontmatter stamps happen via tmp+rename so a crash mid-run never leaves a partial state.

Exit codes: `0` on success, non-zero on input-validation failure or filesystem errors.

### `index rebuild [--stage]`

Regenerate `INDEX.md` and `GRAPH.md` from the current `nodes/` tree. Deterministic. `--stage` runs `git add` afterward (for pre-commit hooks); no-op outside a git repo, and no-op when the tree already matches.

### `lint [--verbose]`

Mechanical KB content health checks: dangling edges, slug/id mismatch, tag duplicates, orphans. Exit 1 on errors, 0 on findings.

### `status`

Prints queued captures, pending session logs, pending curator conflicts, node counts.

### `doctor [--verbose]`

Verifies hook installation, secret-scan availability, and schema validity.

### `init [--harnesses <list>] [--upgrade]`

First-time setup. Writes the KB scaffold, per-harness hooks/skills, and a managed `.gitignore` block. `--upgrade` refreshes templates while preserving `config.yaml` and local prompt overrides.

### `logs prune`

Deletes `_logs/**/*.jsonl` older than `logsRetentionDays` (default 30).

## Project settings — `.ai/knowledge-base/config.yaml`

Committed, strict (unknown keys are a hard error):

```yaml
schema_version: 1
curationThreshold: 5          # pending logs that trigger the nudge
logsRetentionDays: 30         # retention for `logs prune`
lintEveryNSessions: 50        # background lint cadence
cliDefaultHarness: codex      # fallback when no --harness and no env detection
```

### Model + effort for the proposal drain (optional)

The `proposal-drain` hook is the only surviving `claude -p` subprocess site after the launcher refactor: it still spawns a headless claude to convert each captured session log into a structured proposal. Its model and effort can be configured:

```yaml
proposalModel: { name: haiku, effort: low }
```

`name` ∈ `haiku | sonnet | opus`. `effort` ∈ `low | medium | high | xhigh | max`. Both sub-keys are required when the object is present. Omit the object to use the user's `claude` CLI default.

`curatorModel` and `bootstrapModel` no longer apply — the LLM for curate and bootstrap now runs in the host harness session under whatever model the user has selected for their session, not a separately-spawned subprocess.

## Skills

The launchers above are the recommended entry points for headless / CI use. From inside a host harness session, prefer the slash-commands directly:

| Slash command | Launcher equivalent | What it does |
|---|---|---|
| `/kb-add` | `node add` | Conversationally gather node fields, then persist via `node write`. |
| `/kb-curate` | `curate` | Read pending session logs, draft proposals, hand the merged set to `curate-dedup`, run `index rebuild`. |
| `/kb-bootstrap [path]` | `bootstrap --from <path>` | Enumerate docs via `finddocs`, read each, draft nodes, persist via `node write`, run `index rebuild`. |

Skills and launchers run the same logic. The slash-command path keeps the work inside your existing harness context (no extra process spawn); the launcher path is meant for shell / CI use.

Skill authors writing their own KB skills should not hardcode `--harness` — see [Internals → Adapters](internals/architecture.md#adapter-interface) for the detect-harness recipe.
