---
title: Manual test plan
parent: Internals
nav_order: 5
---

# Manual test plan

Checks that resist automation: real Claude Code sessions, non-Linux OS, and human judgment on capture quality.

{% include callout.html variant="prereq" content="Run before any significant release (minor bump, schema bump, or pinned `@anthropic-ai/claude-code` bump). Record results in the release PR." %}

## Clean sandbox

```sh
mkdir kk-manual-test && cd kk-manual-test
git init
echo "node_modules" > .gitignore
npm pack ../path/to/kenkeep
npm init -y
npx ./e0ipso-kenkeep-<v>.tgz init --harnesses claude
npm install
npx kenkeep doctor
```

`doctor` should exit 0 (warnings OK).

## 1. Platform smoke

For each OS: set up a clean sandbox, trigger one `Stop` capture, and confirm `_sessions/` has one new file with `proposal_status: pending`.

- [ ] macOS (latest)
- [ ] Linux (Ubuntu 22.04+)
- [ ] Windows WSL2: hook command in `.claude/settings.json` uses `node`, forward slashes
- [ ] Windows native PowerShell: best-effort. Watch for CRLF in `.claude/hooks/*.mjs` (must be LF).

## 2. PreCompact timing

The hook contract is ≤1s wall-clock.

- [ ] Feed a session ~30k tokens until auto-compact triggers.
- [ ] Time from indicator appearing to session resuming. Under 2s (our portion is the lead).
- [ ] Resulting `_sessions/<log>.md` contains the **full transcript slice**, not a summary.
- [ ] If the deadline fires, the next `Stop`/`SessionEnd` still produces a log covering the missed window.

{% include callout.html variant="tip" content="Diagnostic: `time node .claude/hooks/kk-capture.mjs < /dev/null` should be under 200ms cold. Over 1s usually means a slow filesystem, or the consumer hasn't run `npm install`." %}

## 3. End-to-end happy path

Quality judgment.

1. [ ] Fresh sandbox.
2. [ ] 10-15 messages of substantive conversation about an invented project. End the session.
3. [ ] `_sessions/` shows one `proposal_status: pending` log.
4. [ ] Open a new session. Wait 30-90s. `_logs/proposal/` has a new `.jsonl`. Log flips to `proposal_status: done`.
5. [ ] `curate` writes 1-4 nodes under `nodes/` and regenerates `ENTRY.md`. Are these the **right** facts to remember? (Target: ≥80% acceptance.)
6. [ ] `git diff nodes/` shows the new files. `git add` the ones you want, `git commit`. The pre-commit hook regenerates and stages a fresh `ENTRY.md`/`GRAPH.md` into the same commit. `git restore nodes/<unwanted>.md` to drop the rest.
7. [ ] One more session. Ask Claude "what do you know about this project?" The response references something committed.

If curator output is clearly noise, bump the proposal prompt's `Version:` and tighten "what to skip".

## 4. `init --upgrade` against an older install

1. [ ] Install the last published version. Commit.
2. [ ] Edit `proposal-extract.md` (add a sentinel) and add a custom key to `config.yaml`.
3. [ ] Install the candidate build.
4. [ ] `init --upgrade --dry-run`. Read the changelist.
5. [ ] `init --upgrade`. Confirm:
   - [ ] Sentinel comment preserved.
   - [ ] Custom `config.yaml` key preserved.
   - [ ] `kk-capture.mjs` reflects the new version.
   - [ ] `installed-version` shows the new version.
6. [ ] `doctor` exits 0, no version mismatch.

## 5. `logs prune` on real logs

- [ ] After §3, both `_logs/proposal/` and `_logs/curator/` have 1-3 JSONL files.
- [ ] Backdate one: `touch -d "60 days ago" <file>`.
- [ ] `logs prune` deletes the backdated file and reports `pruned 1 files`. Recent files survive.
- [ ] Set `logsRetentionDays: 0` in `config.yaml`, rerun: every `*.jsonl` under `_logs/` is deleted.
- [ ] Set `logsRetentionDays: 365`, rerun on an already-pruned tree: reports `pruned 0 files`, no error.

## 6. `/kk-bootstrap`

- [ ] In a sandbox with a small public repo (README + architecture.md), `init` and open Claude Code.
- [ ] Run `/kk-bootstrap`. Agent reads source docs, writes nodes directly under `nodes/<kind>/`, reports a summary including any collisions skipped.
- [ ] Walk `git diff nodes/` (or use a tool like [self-review](https://github.com/e0ipso/self-review)). `git commit` the ones you want; `git restore <path>` the rest.
- [ ] No node carries a literal secret or stale TODO from the source docs.

## 7. `bootstrap` discovery and hash-aware re-run

- [ ] In a repo with 50+ markdown files (>200k chars), run `finddocs` to preview discovery. The output is one `+ <relpath>` line per surviving file; confirm the count matches your expectation given `.kkignore`.
- [ ] Run `bootstrap --from <subset>` against 3-5 docs. Inspect `bootstrap-state.json`. Each processed doc has an entry with `content_sha256` and `produced_nodes`.
- [ ] Re-run `bootstrap --from <subset>`. The skill should report that every doc was hash-skipped.
- [ ] Edit one file. Re-run. Only that file is reprocessed.

## 8. Single-author skill sessions (no cross-process lock)

Curate and bootstrap take no `state.json` lock; they are single-author by design.

- [ ] Run two `curate` launchers in parallel against the same repo (`&` in a shell). Both run to completion; neither errors out with "locked". After both finish, run `index rebuild` and `doctor`. `state.json` and session-log frontmatter both parse cleanly (Zod validation passes), even though one writer's session-stamp updates may have silently lost to the other.
- [ ] Worst case is some sessions reprocess on the next `curate` run. Confirm: re-run `curate`, verify the unstamped sessions get processed.
- [ ] The proposal-drain hook still takes its own `proposal-drain` lock (independent surface). Trigger two `SessionStart` events in quick succession against the same repo; the second drain skips while the first holds the lock and reclaims it after the 30-min TTL on the next run.

## 9. Settings file

- [ ] With no `config.yaml`, `curate` uses built-in defaults (`curationThreshold: 5`, `logsRetentionDays: 30`, `lintEveryNSessions: 50`).
- [ ] Add project `.ai/kenkeep/config.yaml` with `curationThreshold: 3`. Re-run honors 3.
- [ ] Add an unknown key (e.g. `foo: bar`). `curate` exits with an error naming the file.

## 10. Doctor exit codes

Reset between scenarios.

- [ ] Delete `installed-version`. Doctor errors, exit 1.
- [ ] Hand-edit a node to add fake `derived_from: nonexistent.md`. Warning, exit 0.
- [ ] Hand-edit a node's `summary` after a curate run. ENTRY stale warning, exit 0.
- [ ] Install v(N-1), drop v(N) binary without upgrading. Version-mismatch warning, exit 0.

## What this plan does NOT cover

Automated tests cover these:

- Frontmatter Zod parsing (`tests/lib/schemas.test.ts`)
- `nodes_hash`, INDEX/GRAPH determinism (`tests/lib/index-gen.test.ts`)
- Pipeline logic with mocked subprocess (`tests/lib/{proposal-drain,curate,bootstrap}.test.ts`)
- CLI argument parsing (per-command integration tests)
- Logs-prune duration parsing (`tests/lib/logs-prune.test.ts`)

If a manual check uncovers a regression that automation should have caught, write the missing test in the fix PR.
