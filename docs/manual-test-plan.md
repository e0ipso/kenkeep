---
title: Manual test plan
nav_order: 9
permalink: /manual-test-plan/
---

# Manual test plan

Checks that resist automation: real Claude Code sessions, non-Linux OS, and human judgment on capture quality. Run before any significant release (minor bump, schema bump, or pinned `@anthropic-ai/claude-code` bump). Record results in the release PR.

## Clean sandbox

```sh
mkdir kb-manual-test && cd kb-manual-test
git init
echo "node_modules" > .gitignore
npm pack ../path/to/ai-knowledge-base
npx ./e0ipso-ai-knowledge-base-<v>.tgz init --assistants claude
pre-commit install
ai-knowledge-base doctor
```

`doctor` should exit 0 (warnings OK).

## 1. Platform smoke

For each OS, set up a clean sandbox and trigger one `Stop` capture. Confirm `_sessions/` contains one new file with `gitleaks_status: clean` and `stage_2_status: pending`.

- [ ] macOS (latest)
- [ ] Linux (Ubuntu 22.04+)
- [ ] Windows WSL2: hook command in `.claude/settings.json` uses `node`, forward slashes
- [ ] Windows native PowerShell: best-effort. Watch for CRLF in `.claude/hooks/*.mjs` (must be LF) and `pre-commit install` failures on the gitleaks hook.

## 2. PreCompact timing

The hook contract is ≤1s wall-clock.

- [ ] Feed a session ~30k tokens until auto-compact triggers.
- [ ] Time from indicator appearing to session resuming. Under 2s (our portion is the lead).
- [ ] Resulting `_sessions/<log>.md` contains the **full transcript slice**, not a summary.
- [ ] If the deadline fires, the next `Stop`/`SessionEnd` still produces a log covering the missed window.

Diagnostic: `time node .claude/hooks/kb-capture.mjs < /dev/null` should be under 200ms cold. Over 1s usually means gitleaks (not on PATH, or scanning over a slow network drive).

## 3. Gitleaks per platform

After `pre-commit install`:

- [ ] macOS / Linux / WSL2: `which gitleaks` resolves under `~/.cache/pre-commit/...`. `doctor` reports it.
- [ ] Native Windows: install via `scoop` or `choco`; `doctor` warns until then.

Redaction:

- [ ] Add a fake secret (e.g. `AWS_SECRET_ACCESS_KEY="AKIAEXAMPLE1234567890"`) in a session. Trigger `Stop`.
- [ ] The log shows `gitleaks_status: redacted`, the secret replaced by `<REDACTED:aws-access-token>`, and a `gitleaks_findings` list.

## 4. End-to-end happy path

Quality judgment.

1. [ ] Fresh sandbox.
2. [ ] 10-15 messages of substantive conversation about an invented project. End the session.
3. [ ] `_sessions/` shows one `stage_2_status: pending` log.
4. [ ] Open a new session. Wait 30-90s. `_logs/stage-2/` has a new `.jsonl`. Log flips to `stage_2_status: done`.
5. [ ] `curate` writes 1-4 proposals and regenerates `INDEX.md`. Are these the **right** facts to remember? (Target: ≥80% acceptance.)
6. [ ] `proposals review`: accept all. Files land in `nodes/`.
7. [ ] One more session. Ask Claude "what do you know about this project?" The response references something curated.

If proposals are clearly noise, bump the stage-2 prompt's `Version:` and tighten "what to skip".

## 5. `init --upgrade` against an older install

1. [ ] Install the last published version. Commit.
2. [ ] Edit `stage-2-extract.md` (add a sentinel) and add a custom key to `.config.json`.
3. [ ] Install the candidate build.
4. [ ] `init --upgrade --dry-run`. Read the changelist.
5. [ ] `init --upgrade`. Confirm:
   - [ ] Sentinel comment preserved.
   - [ ] Custom `.config.json` key preserved.
   - [ ] `kb-capture.mjs` reflects the new version.
   - [ ] `installed-version` shows the new version.
6. [ ] `doctor` exits 0, no version mismatch.

## 6. `logs prune` on real logs

- [ ] After §4, both `_logs/stage-2/` and `_logs/curator/` have 1-3 JSONL files.
- [ ] Backdate one: `touch -d "60 days ago" <file>`.
- [ ] `logs prune --dry-run` lists the backdated file. Recent files aren't listed.
- [ ] `logs prune` deletes only the backdated file.
- [ ] `logs prune --older-than 0s` deletes everything.
- [ ] `logs prune --older-than 1y` reports 0 files, no error.

## 7. `/kb-bootstrap`

- [ ] In a sandbox with a small public repo (README + architecture.md), `init` and open Claude Code.
- [ ] Run `/kb-bootstrap`. Agent reads source docs, writes proposals under `_proposed/additions/`, stops to ask for review.
- [ ] `proposals review` walks each. Acceptances land in `nodes/`.
- [ ] No proposal carries a literal secret or stale TODO from the source docs.

## 8. `bootstrap-incremental` chunking

- [ ] In a repo with 50+ markdown files (>200k chars), run `--dry-run`. Reported batch count should be reasonable (10k tokens ≈ 40k chars per batch).
- [ ] Run without `--dry-run`. Inspect `bootstrap-state.json`.
- [ ] Re-run. Output: 0 files to process.
- [ ] Edit one file. Re-run. Only that file is reprocessed.

## 9. Concurrent locking

- [ ] `curate` running in one terminal. Start `curate` in a second. Second exits with "locked by curator (pid ...)".
- [ ] Same with `bootstrap-incremental` against itself.
- [ ] Cross-pipeline: `curate` and `bootstrap-incremental` do **not** block each other (distinct lock names).
- [ ] Stale-lock recovery: edit `state.json` to set `acquired_at` 31 minutes ago. Next `curate` reclaims and proceeds.

## 10. Settings layering

- [ ] Edit `~/.config/@e0ipso/ai-knowledge-base/config.json` to set `indexBudgetTokens: 999`. Without a project file, `index rebuild` reports budget 999.
- [ ] Add project `.config.json` with `indexBudgetTokens: 1500`. Re-render reports 1500.
- [ ] Pass `--budget-tokens 2500`. CLI wins, reports 2500.

## 11. Doctor exit codes

Reset between scenarios.

- [ ] Delete `installed-version`. Doctor errors, exit 1.
- [ ] Delete `.pre-commit-config.yaml`. Doctor errors, exit 1.
- [ ] Hand-edit a node to add fake `derived_from: nonexistent.md`. Warning, exit 0.
- [ ] Hand-edit a node's `summary` after a curate run. INDEX stale warning, exit 0.
- [ ] Install v(N-1), drop v(N) binary without upgrading. Version-mismatch warning, exit 0.

## What this plan does NOT cover

Automated tests cover these:

- Frontmatter Zod parsing (`tests/lib/schemas.test.ts`)
- `nodes_hash`, INDEX/GRAPH determinism (`tests/lib/index-gen.test.ts`)
- Pipeline logic with mocked subprocess (`tests/lib/{stage2-drain,curate,bootstrap}.test.ts`)
- CLI argument parsing (per-command integration tests)
- Real-claude E2E full cycle (`KB_RUN_REAL_CLAUDE=1 npx vitest run tests/e2e`)
- Logs-prune duration parsing (`tests/lib/logs-prune.test.ts`)

If a manual check uncovers a regression that automation should have caught, write the missing test in the fix PR.
