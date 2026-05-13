---
title: Manual test plan
parent: Internals
nav_order: 5
---

# Manual test plan

Checks that resist automation: real Claude Code sessions, non-Linux OS, and human judgment on capture quality. Run before any significant release (minor bump, schema bump, or pinned `@anthropic-ai/claude-code` bump). Record results in the release PR.

## Clean sandbox

```sh
mkdir kb-manual-test && cd kb-manual-test
git init
echo "node_modules" > .gitignore
npm pack ../path/to/ai-knowledge-base
npm init -y
npx ./e0ipso-ai-knowledge-base-<v>.tgz init --assistants claude
npm install
npx @e0ipso/ai-knowledge-base doctor
```

`doctor` should exit 0 (warnings OK).

## 1. Platform smoke

For each OS, set up a clean sandbox and trigger one `Stop` capture. Confirm `_sessions/` contains one new file with `secret_scan_status: clean` and `proposal_status: pending`.

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

Diagnostic: `time node .claude/hooks/kb-capture.mjs < /dev/null` should be under 200ms cold. Over 1s usually means secretlint is loading from a slow filesystem, or the consumer hasn't run `npm install`.

## 3. Secretlint per platform

After `npm install`:

- [ ] macOS / Linux / WSL2: `node_modules/@secretlint/core` exists. `doctor` reports secretlint resolvable.
- [ ] Native Windows: same, since secretlint is a pure-JS Node package with no platform-specific binaries.

Redaction:

- [ ] Add a fake secret (e.g. `GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz`) in a session. Trigger `Stop`.
- [ ] The log shows `secret_scan_status: redacted` and the secret replaced by `[REDACTED:<rule-id>]`.

## 4. End-to-end happy path

Quality judgment.

1. [ ] Fresh sandbox.
2. [ ] 10-15 messages of substantive conversation about an invented project. End the session.
3. [ ] `_sessions/` shows one `proposal_status: pending` log.
4. [ ] Open a new session. Wait 30-90s. `_logs/proposal/` has a new `.jsonl`. Log flips to `proposal_status: done`.
5. [ ] `curate` writes 1-4 nodes under `nodes/` and regenerates `INDEX.md`. Are these the **right** facts to remember? (Target: ≥80% acceptance.)
6. [ ] `git diff nodes/` shows the new files. `git add` the ones you want, `git commit`. The pre-commit hook regenerates and stages a fresh `INDEX.md`/`GRAPH.md` into the same commit. `git restore nodes/<unwanted>.md` to drop the rest.
7. [ ] One more session. Ask Claude "what do you know about this project?" The response references something committed.

If curator output is clearly noise, bump the proposal prompt's `Version:` and tighten "what to skip".

## 5. `init --upgrade` against an older install

1. [ ] Install the last published version. Commit.
2. [ ] Edit `proposal-extract.md` (add a sentinel) and add a custom key to `config.yaml`.
3. [ ] Install the candidate build.
4. [ ] `init --upgrade --dry-run`. Read the changelist.
5. [ ] `init --upgrade`. Confirm:
   - [ ] Sentinel comment preserved.
   - [ ] Custom `config.yaml` key preserved.
   - [ ] `kb-capture.mjs` reflects the new version.
   - [ ] `installed-version` shows the new version.
6. [ ] `doctor` exits 0, no version mismatch.

## 6. `logs prune` on real logs

- [ ] After §4, both `_logs/proposal/` and `_logs/curator/` have 1-3 JSONL files.
- [ ] Backdate one: `touch -d "60 days ago" <file>`.
- [ ] `logs prune` deletes the backdated file and reports `pruned 1 files`. Recent files survive.
- [ ] Set `logsRetentionDays: 0` in `config.yaml`, rerun: every `*.jsonl` under `_logs/` is deleted.
- [ ] Set `logsRetentionDays: 365`, rerun on an already-pruned tree: reports `pruned 0 files`, no error.

## 7. `/kb-bootstrap`

- [ ] In a sandbox with a small public repo (README + architecture.md), `init` and open Claude Code.
- [ ] Run `/kb-bootstrap`. Agent reads source docs, writes nodes directly under `nodes/<kind>/`, reports a summary including any collisions skipped.
- [ ] Walk `git diff nodes/` (or use a tool like [self-review](https://github.com/e0ipso/self-review)). `git commit` the ones you want; `git restore <path>` the rest.
- [ ] No node carries a literal secret or stale TODO from the source docs.

## 8. `bootstrap-incremental` chunking

- [ ] In a repo with 50+ markdown files (>200k chars), run `--dry-run`. Reported batch count matches `ceil(files / 20)`.
- [ ] Run without `--dry-run`. Inspect `bootstrap-state.json`.
- [ ] Re-run. Output: 0 files to process.
- [ ] Edit one file. Re-run. Only that file is reprocessed.

## 9. Concurrent locking

- [ ] `curate` running in one terminal. Start `curate` in a second. Second exits with "locked by curator (pid ...)".
- [ ] Same with `bootstrap-incremental` against itself.
- [ ] Cross-pipeline: `curate` and `bootstrap-incremental` do **not** block each other (distinct lock names).
- [ ] Stale-lock recovery: edit `state.json` to set `acquired_at` 31 minutes ago. Next `curate` reclaims and proceeds.

## 10. Settings file

- [ ] With no `config.yaml`, `curate` uses built-in defaults (`curationThreshold: 5`, `logsRetentionDays: 30`, `lintEveryNSessions: 50`).
- [ ] Add project `.ai/knowledge-base/config.yaml` with `curationThreshold: 3`. Re-run honors 3.
- [ ] Add an unknown key (e.g. `foo: bar`). `curate` exits with an error naming the file.

## 11. Doctor exit codes

Reset between scenarios.

- [ ] Delete `installed-version`. Doctor errors, exit 1.
- [ ] Delete `.secretlintrc.json`. Doctor reports the commit-time scan as missing, exit 0 with a warning.
- [ ] Hand-edit a node to add fake `derived_from: nonexistent.md`. Warning, exit 0.
- [ ] Hand-edit a node's `summary` after a curate run. INDEX stale warning, exit 0.
- [ ] Install v(N-1), drop v(N) binary without upgrading. Version-mismatch warning, exit 0.

## What this plan does NOT cover

Automated tests cover these:

- Frontmatter Zod parsing (`tests/lib/schemas.test.ts`)
- `nodes_hash`, INDEX/GRAPH determinism (`tests/lib/index-gen.test.ts`)
- Pipeline logic with mocked subprocess (`tests/lib/{proposal-drain,curate,bootstrap}.test.ts`)
- CLI argument parsing (per-command integration tests)
- Logs-prune duration parsing (`tests/lib/logs-prune.test.ts`)

If a manual check uncovers a regression that automation should have caught, write the missing test in the fix PR.
