---
title: Manual test plan
nav_order: 9
permalink: /manual-test-plan/
---

# Manual test plan

The default test suite (`npm test`) plus the real-`claude` E2E gate (`KB_RUN_REAL_CLAUDE=1 npx vitest run tests/e2e`) covers the parts of the system that can be exercised from inside a vitest process. This page lists the checks that **resist automation** — anything that requires a real Claude Code session, a non-Linux OS, or human judgment on capture quality.

Run this checklist **before any significant release**: a new minor (capture/curate/consume behavior change), a schema bump, or a bumped pinned `@anthropic-ai/claude-code` version. Bug-fix patches that don't touch hooks, prompts, gitleaks, or settings can skip the full run.

Record results in the release PR description as a copy of the section headers below with each item checked off and the test platform listed.

## How to set up a clean sandbox

Most checks below want a throwaway git repo so that real captures don't leak into your daily work. From a scratch directory:

```sh
mkdir kb-manual-test && cd kb-manual-test
git init
echo "node_modules" > .gitignore
npm pack ../path/to/ai-knowledge-base   # produces e0ipso-ai-knowledge-base-<v>.tgz
npx ./e0ipso-ai-knowledge-base-<v>.tgz init --assistants claude
pre-commit install
ai-knowledge-base doctor
```

`doctor` should exit 0 with at most warnings (e.g. gitleaks missing on PATH if you haven't installed it). After this point, open Claude Code in the sandbox dir and use it normally to exercise the capture pipeline.

## 1. Platform smoke

For each supported OS, run [§ How to set up a clean sandbox](#how-to-set-up-a-clean-sandbox) and then a single Stop-triggered capture (open a session, ask Claude one question, end the session). Confirm:

- [ ] **macOS (latest)**: `.ai/knowledge-base/_sessions/` contains one new `<timestamp>-<slug>.md` file with `gitleaks_status: clean` and `stage_2_status: pending`.
- [ ] **Linux (Ubuntu 22.04 or similar)**: same as macOS.
- [ ] **Windows (WSL2 Ubuntu)**: same as macOS. Plus: `.claude/hooks/kb-capture.mjs` is invoked through Node, not Bash — confirm by inspecting `.claude/settings.json` and seeing that the `command` field uses forward slashes and is `node` + the script path (not `bash` + path).
- [ ] **Windows (native PowerShell)**: `init` runs without `ENOENT` errors on the gitleaks pre-commit step. The hook command in `.claude/settings.json` is `node <abs-path>\\.claude\\hooks\\kb-capture.mjs` (backslashes are fine; Claude Code's hook runner normalizes them). A Stop event triggers capture without `EACCES` or line-ending errors. Note: native Windows is best-effort; WSL2 is the recommended path and what the test fixtures pin against.

Common Windows gotchas to inspect when something is off:

- Line endings on `.claude/hooks/*.mjs` — must be LF, not CRLF. `init` writes LF unconditionally; if a `git config core.autocrlf true` rewrite has converted them, `node` will reject the shebang.
- `.pre-commit-config.yaml` references the gitleaks hook by repo URL — `pre-commit install` must succeed before the first commit. If it fails, capture still runs but commits will be unsafe.

## 2. PreCompact timing on long sessions

The PreCompact hook fires before Claude Code's auto-compaction summary runs. The contract is "≤ 1 s wall-clock" so the user doesn't feel the hook. Stress-test it:

- [ ] Open a session and feed it ~30k tokens of conversation (paste a long file, ask multiple questions, etc.) until Claude Code's "Auto-compact" indicator appears.
- [ ] Time the moment the indicator appears to the moment the session resumes. Should be under 2 s total; the kb-capture portion is the gap before Claude's own summarization adds another 5–10 s.
- [ ] Inspect the resulting `_sessions/<log>.md`. It should contain the **full transcript slice** since the previous Stop/SessionEnd/PreCompact event, not a summary.
- [ ] If the deadline fires (capture exits silently), the next Stop or SessionEnd event must still produce a log covering the missed window. Verify by waiting through one Stop after a PreCompact-skipped run.

Diagnostic when capture feels slow: `time node .claude/hooks/kb-capture.mjs < /dev/null` should print under 200 ms cold. If it's over 1 s, gitleaks is the usual culprit — confirm it's on PATH and not being scanned over a slow network drive.

## 3. Gitleaks vendored binary per platform

`init` does not vendor gitleaks; it expects `pre-commit install` to bring it in. Verify the pre-commit-managed install on each platform:

- [ ] macOS: `which gitleaks` after `pre-commit install` resolves under `~/.cache/pre-commit/repo*/gitleaks-bin/gitleaks`. `ai-knowledge-base doctor` reports it as present.
- [ ] Linux: same — confirm the binary is executable and the version matches `.pre-commit-config.yaml`'s pinned rev.
- [ ] Windows WSL2: same. Native Windows: gitleaks needs to be installed via `scoop install gitleaks` or `choco install gitleaks` separately; doctor will warn until it's on PATH.

Then verify the redaction path:

- [ ] Add a fake secret (e.g. `AWS_SECRET_ACCESS_KEY="AKIAEXAMPLE1234567890"`) to the session in a real Claude conversation. Trigger a Stop event.
- [ ] The resulting `_sessions/<log>.md` should have `gitleaks_status: redacted`, the secret value replaced by `<REDACTED:aws-access-token>`, and a `gitleaks_findings` list in the frontmatter.
- [ ] If `gitleaks_status: clean` appears for a known secret, gitleaks is misconfigured or the rule isn't in the default ruleset; file a bug.

## 4. End-to-end happy path with a real session

This is the cycle the automated E2E suite covers, but with a human at the keyboard reading the outputs. The point is to judge quality, not just shape.

1. [ ] Fresh sandbox via [§ How to set up a clean sandbox](#how-to-set-up-a-clean-sandbox).
2. [ ] Open Claude Code in the sandbox. Have a short but substantive conversation (10–15 messages) about a fake project — invent a stack, a decision, a constraint. End the session.
3. [ ] `ls .ai/knowledge-base/_sessions/` shows one log with `stage_2_status: pending`.
4. [ ] Open a **new** Claude Code session in the same dir. The `kb-stage2-drain` hook should run asynchronously; wait ~30–90 s and check `.ai/knowledge-base/_logs/stage-2/`. A new `.jsonl` file should appear, and the session log's frontmatter should flip to `stage_2_status: done` with a `stage_2_summary` populated.
5. [ ] Run `ai-knowledge-base curate`. It should write 1–4 proposals under `_proposed/additions/` and regenerate `INDEX.md`. Skim the proposals — are they the **right things** to remember from that conversation? (This is the success criterion from [PRD §10](https://github.com/e0ipso/ai-knowledge-base/blob/main/PRD.md#10-success-criteria): ≥80% acceptance on first review.)
6. [ ] Run `ai-knowledge-base proposals review`. Accept each one. Files move into `nodes/{practice,map}/<slug>.md`.
7. [ ] Start one more Claude Code session in the dir. The `kb-session-start` hook should inject `INDEX.md` as `additionalContext` — verify by asking Claude "what do you know about this project?" and confirming it references something specific from the curated nodes.

Capture quality judgment is the part no automation covers. If proposals are clearly noise (e.g. "the user asked about X" instead of a durable fact about the project), the stage-2 prompt has drifted — bump its `Version:` comment and tighten the "what to skip" section.

## 5. `init --upgrade` against a real older install

The unit tests cover the preflight against synthetic file trees. This check covers a real upgrade from the previous published version:

1. [ ] In a scratch repo, install the **last published** package from npm: `npx @e0ipso/ai-knowledge-base@<prev-version> init --assistants claude`. Commit everything.
2. [ ] Make a local customization: edit `.ai/.kb-builder/prompts/stage-2-extract.md` (add a sentinel comment), and add a custom key to `.ai/knowledge-base/.config.json`.
3. [ ] Install the candidate build (`npm pack` from the repo, then `npm install -g ./e0ipso-ai-knowledge-base-<v>.tgz`).
4. [ ] Run `ai-knowledge-base init --upgrade --dry-run`. Read the preflight changelist — every file that would be touched should be listed.
5. [ ] Run `ai-knowledge-base init --upgrade` (no dry-run). After it completes:
   - [ ] The sentinel comment in `stage-2-extract.md` is **preserved** (local prompt overrides survive).
   - [ ] The custom key in `.config.json` is **preserved** (settings are not overwritten).
   - [ ] `.claude/hooks/kb-capture.mjs` reflects the new version (`grep VERSION .claude/hooks/kb-capture.mjs` or compare `stat` mtime to other touched files).
   - [ ] `.ai/.kb-builder/installed-version` shows the new package version.
6. [ ] `ai-knowledge-base doctor` exits 0 and reports the installed version matches the package version. No `installed-version mismatch` warning.

## 6. `logs prune` on a real logs/ directory

The unit test covers the filesystem walk; this check covers the operator UX:

- [ ] After §4 (end-to-end happy path), `.ai/knowledge-base/_logs/{stage-2,curator}` should each contain 1–3 JSONL files.
- [ ] Backdate one of them: `touch -d "60 days ago" .ai/knowledge-base/_logs/stage-2/<oldest>.jsonl`.
- [ ] `ai-knowledge-base logs prune --dry-run` lists the backdated file under stage-2 with a non-zero byte estimate. Recent files are not listed.
- [ ] `ai-knowledge-base logs prune` deletes only the backdated file. Recent files survive.
- [ ] `ai-knowledge-base logs prune --older-than 0s` deletes everything (sanity check the duration parser).
- [ ] `ai-knowledge-base logs prune --older-than 1y` reports "0 file(s) older than 1y" with no error.

## 7. First-time bootstrap (`/kb:bootstrap`, agent-driven)

The agent-driven path can't be unit-tested — it depends on Claude Code's tool-using behavior. Verify:

- [ ] In a sandbox with a small real codebase (clone a tiny public repo with a README and an `architecture.md`), run `init` and open Claude Code.
- [ ] Invoke `/kb:bootstrap` and let the agent run to completion. It should:
  - Read the source docs you point it at.
  - Write a handful of proposals under `_proposed/additions/`.
  - Stop and ask you to review (it should **not** auto-promote into `nodes/`).
- [ ] `ai-knowledge-base proposals review` walks each proposal. Acceptances land in `nodes/`.
- [ ] No proposal carries a literal source secret or a stale TODO comment from the source docs (the bootstrap prompt's "what to skip" rules are working).

## 8. Incremental bootstrap against a moving target

Covered by automation for hash-skipping; this check exercises the chunking under real token pressure:

- [ ] In a repo with ≥ 50 markdown files totaling > 200k characters, run `ai-knowledge-base bootstrap-incremental --from docs --dry-run`. Confirm the reported batch count is reasonable (per-batch budget defaults to ~10k tokens ≈ 40k chars).
- [ ] Run without `--dry-run`. Inspect `.ai/.kb-builder/bootstrap-state.json` — every processed file appears with a SHA-256 and the proposal paths it produced.
- [ ] Re-run the same command. Output should report **0 files to process** because all SHAs match.
- [ ] Edit one file and re-run. Only that file is reprocessed.

## 9. Concurrent-pipeline locking

The lock TTL is 30 minutes; manual verification confirms the named-lock contention is real:

- [ ] Start `ai-knowledge-base curate` in one terminal (use a sandbox with enough pending logs that it runs for > 10 s).
- [ ] In a second terminal, start `ai-knowledge-base curate`. It should exit immediately with "locked by curator (pid …)" — not run a second batch.
- [ ] Same check with `bootstrap-incremental` against itself.
- [ ] Cross-pipeline: `curate` and `bootstrap-incremental` use distinct lock names, so they should **not** block each other. Verify by running both simultaneously in a sandbox with both kinds of pending work.
- [ ] Stale-lock recovery: manually edit `.ai/.kb-builder/state.json` to set `lock.acquired_at` to a timestamp 31 minutes ago. The next `curate` should reclaim the lock and proceed (with a stderr note).

## 10. Settings layering

The unit tests cover the resolver; this check confirms it works on a real disk:

- [ ] Edit `~/.config/@e0ipso/ai-knowledge-base/config.json` (create it if missing) to set `indexBudgetTokens: 999`.
- [ ] In a sandbox, do not create a project `.config.json`. Run `ai-knowledge-base index rebuild` and inspect the rendered `INDEX.md`'s footer — the budget should be reported as 999.
- [ ] Create `.ai/knowledge-base/.config.json` with `{"schema_version":1,"indexBudgetTokens":1500}`. Re-run `index rebuild`. The footer now reports 1500 (project wins).
- [ ] Pass `--budget-tokens 2500` on the CLI. The footer reports 2500 (CLI wins).
- [ ] Doctor reports settings-source precedence in `--verbose` mode without error.

## 11. Doctor exit codes against intentionally broken state

For each broken state below, `ai-knowledge-base doctor` should exit **1** for errors and **0** with warnings for the dangling cases. Reset between scenarios:

- [ ] Delete `.ai/.kb-builder/installed-version`. Doctor errors with `installed-version marker missing`. Exit 1.
- [ ] Delete `.pre-commit-config.yaml`. Doctor errors. Exit 1.
- [ ] Hand-edit a `nodes/practice/foo.md` to insert a fake `derived_from: nonexistent.md`. Doctor warns about dangling derived_from. Exit 0.
- [ ] Hand-edit a `nodes/practice/foo.md`'s `summary` field after a curate run. Doctor warns about INDEX.md staleness (`nodes_hash drift`). Exit 0.
- [ ] Install a v(N-1) build, then drop in the v(N) CLI binary without running `init --upgrade`. Doctor warns about `installed-version mismatch`. Exit 0.

## 12. Things this plan intentionally does not cover

These are covered by automation; do **not** re-test them by hand:

- Frontmatter Zod parsing — `tests/lib/schemas.test.ts`.
- `nodes_hash`, INDEX/GRAPH determinism — `tests/lib/index-gen.test.ts`.
- Stage-2 / curator / bootstrap pipeline logic with mocked subprocess — `tests/lib/{stage2-drain,curate,bootstrap}.test.ts`.
- CLI argument parsing — the per-command integration tests.
- Real-`claude` E2E full cycle — `KB_RUN_REAL_CLAUDE=1 npx vitest run tests/e2e` (run before release; tracks Claude model drift on the same machine).
- Logs-prune duration parsing — `tests/lib/logs-prune.test.ts`.

If a manual check uncovers a regression that should have been caught by automation, write the missing test in the same PR as the fix.
