---
title: Continuous integration
nav_order: 4.5
---

# Continuous integration

kenkeep ships a ready-to-copy GitHub Actions workflow that surfaces the
**deterministic, read-only** health signals of your knowledge base on every PR
that touches `.ai/kenkeep/**`. It runs no LLM, mutates no `nodes/`, and opens no
auto-commits — it just annotates the PR and nudges a human to act.

{% include callout.html variant="tip" content="The workflow is read-only by design. It runs `lint`, `doctor`, `freshness`, and a read-only drift-catcher — never `curate` or `bootstrap`. The LLM curates in a human-supervised session, not in a CI runner (constitution §3)." %}

## Overview

The example workflow lives at [`examples/kenkeep-check.yml`](https://github.com/e0ipso/kenkeep/blob/main/examples/kenkeep-check.yml) in the kenkeep repo. It is **not** auto-discovered by GitHub (workflows under `examples/` never run), so it is safe to ship at repo root. To use it, you copy it into your own repo's `.github/workflows/`.

On every matching PR it:

1. Runs `kenkeep lint`, `kenkeep doctor`, `kenkeep freshness`, and a read-only `index rebuild && git diff --exit-code` drift-catcher.
2. Posts (or updates, in place) a **single** PR comment summarising the findings.
3. Nudges a human toward the remediation commands.

The comment is matched across pushes by a stable HTML marker (`<!-- kenkeep-check -->`), so the thread stays to one comment per PR rather than spamming.

## Drop-in usage

1. Copy the file into your repo:

   ```sh
   mkdir -p .github/workflows
   curl -fsSL https://raw.githubusercontent.com/e0ipso/kenkeep/main/examples/kenkeep-check.yml \
     -o .github/workflows/kenkeep-check.yml
   ```

2. Confirm `actions/checkout` keeps `fetch-depth: 0` — it is mandatory for `kenkeep freshness` (see [Caveats](#caveats)).
3. Open a PR touching `.ai/kenkeep/**` and watch the `KB health (read-only)` job.

{% include callout.html variant="warning" content="If your consumer repo has **no `package-lock.json`**, remove the `cache: 'npm'` key from the `setup-node` step. The workflow consumes the published `kenkeep` package via `npx` (it does not run `npm ci`), so a missing lockfile only affects that cache hint — but `setup-node` will error on a missing lockfile if the key is left in." %}

The workflow is scoped to the least-privilege permissions it needs: `contents: read` and `pull-requests: write` (the latter only to post the PR comment). No `id-token`, no secrets, no `packages`.

## What each step does

| Step | Command | Exit semantics | Fails the job? |
|---|---|---|---|
| lint | `npx --yes kenkeep lint --verbose` | exit 1 on errors (dangling edges, slug/id mismatch, missing index); findings like orphans / tag-near-duplicate are stderr warnings | **Yes** on errors |
| doctor | `npx --yes kenkeep doctor --verbose` | exit 1 only on hard failures; staleness / freshness / harness-install warnings return 0 | Hard errors yes (re-checked by the final gate); warnings no |
| freshness | `npx --yes kenkeep freshness --verbose` | always exits 0 (advisory); fails open on non-git / error / empty | No |
| drift-catcher | `npx --yes kenkeep index rebuild` then `git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md` | `git diff --exit-code` returns 1 on any diff (drift) | Yes on drift (re-checked by the final gate) |
| comment | `peter-evans/find-comment` + `peter-evans/create-or-update-comment` | n/a | No (runs `if: always()`) |

The `doctor` and drift-catcher steps use `continue-on-error: true` so a failure there does not skip the comment step — you still get the summary. A **final status gate** step then re-fails the job if either of those two hard-errored, so failures are not swallowed. `lint` fails the job directly (its errors are not recoverable).

The drift-catcher regenerates `ENTRY.md` and `GRAPH.md` **in the CI workspace only** — the regenerated files are never staged, never committed, and never written to `nodes/`. They exist solely to feed `git diff --exit-code`, which is the read-only verifier. If the committed artifacts differ from the deterministic regeneration, the step reports drift. This is the exact recipe endorsed by [`practice-dont-run-llm-pipelines-in-ci`](https://github.com/e0ipso/kenkeep/blob/main/.ai/kenkeep/nodes/conventions/practice-dont-run-llm-pipelines-in-ci.md).

## Caveats

### Shallow checkout vs freshness

`kenkeep freshness` is git-anchored: it derives each node's "curated at" point from git history. On a shallow clone (the GitHub Actions default), history is truncated and freshness **silently degrades to fewer flags, never to an error** — you get a false "all healthy" signal. The shipped workflow sets `fetch-depth: 0` to pull full history. Keep it.

### `doctor` harness-install warnings are expected in CI

`doctor` prints a per-harness install-status block (hooks, skills, detection, hook placement). A generic CI runner has no harness CLI and no hooks installed, so those warnings **always fire** and are not actionable unless your consumer repo actually has a harness wired up. The workflow posts them verbatim and the comment labels the `doctor` section accordingly. Do not treat them as a reason to block a merge.

### The drift-catcher never commits

To a careful reviewer, `index rebuild` in a CI step can look like a "write". It is not: the regeneration is local computation in the runner's workspace, the files are discarded at job end, and `git diff --exit-code` is a read-only comparison. Constitution §3 forbids writing to `nodes/` and this step does not touch it.

## Reading the PR comment

The comment has one collapsible `<details>` section per command, each showing the command's exit status (✅ / ❌ / ⏭️) and its output truncated to 4 KB (full output lives in the workflow run log, linked from the comment header).

When something needs attention, the **Remediation** section points you at the two local actions:

- **Process accumulated session captures** — run the curation skill in your harness session, then review with `git diff` and `git commit`. See [Daily use → The loop](daily-use.md#the-loop).
- **Regenerate the committed index** — run `npx kenkeep index rebuild` locally and commit the regenerated `ENTRY.md` / `GRAPH.md` so the injected catalog stops drifting from the nodes tree.

On zero findings, the comment reports a healthy KB so you get a positive signal, not silence.

## Why not OpenWiki's unattended-agent-PR model

Some knowledge tools (e.g. an `examples/openwiki-update.yml` pattern) run an agent on a schedule and open a docs PR via `peter-evans/create-pull-request` — the LLM writes the knowledge base and a human merely merges the auto-PR. Kenkeep deliberately refuses that model, for three reasons grounded in its constitution:

1. **Constitution §3** mandates human-in-the-loop curation: *"nothing writes to the knowledge base without `/kk-curate` + `git commit`."* An auto-PR that writes `nodes/` inverts this — the write happens before acceptance.
2. **`practice-dont-run-llm-pipelines-in-ci`** forbids `curate` and `bootstrap` in CI. They launch the host harness in `-p` mode and run the LLM, which is human-supervised by design.
3. **The knowledge base is a team artifact, not an auto-generated cache.** Nodes encode reviewed, versioned decisions; auto-generated knowledge rots silently and erodes trust in the catalog.

Kenkeep's CI slice is therefore the **deterministic, read-only nudge**: the runner measures health and tells a human what to do; the LLM curates in a human-supervised session, and the human commits the result. The automation points at the work; it does not do the writing.
