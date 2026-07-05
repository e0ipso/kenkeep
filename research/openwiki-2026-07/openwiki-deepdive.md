# OpenWiki Deep-Dive & Improvement Ideas for kenkeep

## Part 1 — OpenWiki Inventory

**What it is.** LangChain's `openwiki` npm CLI (v0.0.1) runs an LLM agent that generates/maintains a markdown wiki under `openwiki/`. Ink terminal app + one-shot modes + a GitHub Action for scheduled updates. ~10 source files.

**Feature list.** Three modes `chat`/`init`/`update` (`src/agent/types.ts:1`). CLI: bare chat, `openwiki "msg"`, `--init`, `--update`, `-p/--print`, `--modelId`, `--help`, dev `--dry-run` (`src/commands.ts:38-164`). Auto-exit for init/update in a TTY. Five providers (OpenRouter default, Baseten, Fireworks, OpenAI, Anthropic) each with curated + custom model ids (`src/constants.ts:42-95`). OpenRouter multi-model fallback + 5xx retry (`src/agent/index.ts:92-151,381-437`). Credential onboarding to `~/.openwiki/.env` (0600). Optional LangSmith tracing. Incremental updates via `openwiki/.last-update.json` gitHead. Content-snapshot no-op detection. Auto-inserts an `## OpenWiki` block into AGENTS.md/CLAUDE.md. SQLite checkpointer. Read-only subagents. Secret-redacting OpenRouter debug capture.

**Architecture & loop.** Built on `deepagents` `createDeepAgent` with a `LocalShellBackend` (`virtualMode:true`, `rootDir:cwd`, `maxOutputBytes:100_000`, `timeout:120`; `index.ts:180-191`). Empty explicit-tools array — the agent uses backend fs/shell tools + a `task` subagent. Models via `ChatAnthropic`/`ChatOpenRouter`/`ChatOpenAI` (`createModel`, `index.ts:381-411`) — **BYO API key**. Loop: load env → resolve provider/key/model → model-fallback wrapper → build `RunContext` (git + last-update) → snapshot `openwiki/` hash → stream (`streamMode:["messages","tools"], subgraphs:true`) → a large hand-rolled normalizer emits text/tool events to Ink → if post-snapshot ≠ pre-snapshot, write `.last-update.json`. `thread_id = openwiki-<sha256(cwd)[:32]>-<runId>` persisted in SQLite.

**Prompt engineering (verbatim, `src/agent/prompt.ts`).** The product is basically one system prompt.
- Grounding (`:18`): "Do not invent files, modules, APIs… Ground every important claim in source files, existing docs, or git evidence you have inspected."
- Sampling discipline (`:24-26`): "Do not exhaustively read every file… Do not call glob with `**/*` from the repository root… Prefer grep/glob and short targeted reads."
- Plan file (`:39-43`): "create a temporary `openwiki/_plan.md`… lists the intended wiki pages, source evidence for each page, and remaining questions… Before completing the run, delete `openwiki/_plan.md`."
- Git-as-why (`:46-50`): "Use git heavily where it helps explain why code exists, not just what code exists… inspect commits added since the previous successful OpenWiki run. Prefer the gitHead recorded in `openwiki/.last-update.json`."
- Anti-thin-page (`:109-118`): "Avoid thin pages… For small repositories with about 10 or fewer primary source files, prefer `openwiki/quickstart.md` plus at most 1-2 supporting pages."
- Surgical update / diff budget (`:159-174`): "Update runs must be surgical… Prefer replacing one stale sentence over adding new paragraphs… if fewer than about 5 source files changed, update at most 1-2 wiki pages… Updates may be a no-op… Say that the wiki is already current."
- Docs-impact plan (`:164`): "source change -> docs affected -> edit needed -> why."
- One canonical home (`:106`); read-only subagent discipline (`:31-37`); no-secrets (`:91-96`); exact AGENTS/CLAUDE template with "refresh only if stale, don't reformat" (`:57-78`). Init caps at ≤8 pages.

**GitHub Action update flow — incremental & diff-based.** `.last-update.json` records `updatedAt/command/gitHead/model` (`utils.ts:39-58`). Next `update` uses `git log <gitHead>..HEAD --name-status`, falling back to `--since <updatedAt>`, plus `git status --short` and `git diff --name-status HEAD` (`utils.ts:181-246`), injected into the prompt. SHA-256 content snapshot over `openwiki/` (minus `.last-update.json`) gates the metadata write so no-op runs produce no diff (`index.ts:231-244`). Workflow: `workflow_dispatch` + daily cron `0 8 * * *`, `contents/pull-requests: write`, installs openwiki globally, runs `openwiki --update --print`, opens a PR via `peter-evans/create-pull-request` on branch `openwiki/update` scoped to `openwiki`. **Fully unattended** — no human gate before the PR.

**Wiki structure.** `quickstart.md` mandated entrypoint; section dirs (`architecture/`, `agent/`, `cli/`, `operations/`). Every page ends with "Things to watch when editing" + "Source map" + a git-evidence commit list, written explicitly for future agents.

**Credentials/DX.** `~/.openwiki/.env` (dir 0700/file 0600); process-env wins over file; secret-safe diagnostics (source, masked preview, whitespace/quote/newline/invalid-id warnings); regex-redacted OpenRouter error bodies; arrow-key provider/model menus; clear non-TTY errors; in-session `/init /update /provider /model /exit`.

## Part 2 — Improvement ideas for kenkeep

1. **Repo-change staleness signal for nodes (the gitHead trick) — fits.** OpenWiki diffs `git log <gitHead>..HEAD` to catch docs describing changed code. kenkeep only has *structural* index staleness (`nodes_hash`, `doctor.ts:263-268`) and *backlog age* (`DEFAULT_STALE_DAYS=7`, `session-start.ts`). No signal that code under a node's topic changed since curation. Propose a deterministic read-only `kenkeep freshness` primitive: stamp a `curated_at` commit sha and diff changed paths against nodes' `derived_from`/referenced files; surface a count in the nudge + `doctor`. Git-native, no LLM, human decides. **Biggest gap.**
2. **Explicit deletable plan file in curate/bootstrap — fits.** OpenWiki's `_plan.md` (`prompt.ts:39-43`). kenkeep has no reviewable plan before nodes land. Write a gitignored `.ai/kenkeep/_curate-plan.md` (candidate → target node → action → evidence) as a mid-run checkpoint + self-check. Per-user scratch, keeps human-in-loop.
3. **Adopt surgical-update / no-op-is-valid prompt language in kk-curate — fits.** kenkeep is strong on *admission* but lighter on *modification restraint*. Add "prefer minimal in-place edits; a no-op curate is correct; don't churn accurate nodes" to `knowledge-admission.md`/kk-curate (bump prompt Version). Keeps diffs small — reinforces review value.
4. **Change-oriented "what to watch when editing" on map nodes — adaptation.** OpenWiki puts this on every page. Encourage (in prompts, not schema) map nodes to carry a "when changing this, verify…" clause + edges to relevant practice nodes. No frontmatter field (avoid schema bump); keep optional to avoid phantom guidance.
5. **Diagnostic polish à la OpenWiki — fits.** Borrow the secret-safe, actionable diagnostics bar for `doctor`: per-harness registered-vs-missing files, detection status, and frontmatter hygiene warnings (stray whitespace in tags, non-resolving `derived_from`).
6. **Ship a CI workflow — but as a check/nudge, adaptation (partial conflict).** OpenWiki's unattended daily agent-PR **conflicts** with kenkeep's "no LLM pipelines in CI / human-in-the-loop." Safe slice: a deterministic read-only workflow running `lint` + `doctor` + the freshness check (Idea 1) that annotates a PR when the index is stale/edges dangle and comments "N nodes may be stale; consider `/kk-curate`." Never mutates `nodes/`. Flag OpenWiki's auto-commit model as off-limits.
7. **Resilience / redaction hygiene — adaptation.** OpenWiki hardens with model fallback + 5xx retry. kenkeep's pending-log retry is already graceful and it deliberately has no provider layer, so mostly confirmation; the borrowable piece is secret-redacting the `_logs/` stream-json and captured shell commands (optional defense-in-depth; PRD §6 already accepts "safe by review, not scanner").
8. **"One canonical home + link, don't duplicate" dedup guardrail — fits.** Make OpenWiki's canonical-home rule explicit in kk-curate's dedup step to bias toward merging overlapping nodes + edges over near-duplicates. Prompt-level, strengthens existing `curate-dedup`.
9. **SessionStart advisory from freshness — fits (depends on Idea 1).** If Idea 1 lands, append one line to the injected context ("nodes under branch/x may be stale — code changed since curation") so the descending agent applies mild skepticism. Reuses existing sync SessionStart surface.

## Part 3 — Where kenkeep is BETTER (value-prop contrast)

1. **Human-in-the-loop by construction** vs OpenWiki's unattended daily agent-PR.
2. **No API keys / no separate spend** — runs on the harness subscription, not BYO OpenRouter/Anthropic keys.
3. **Deterministic, schema-validated writes via primitives** vs OpenWiki's LLM writing files directly through the shell backend.
4. **Progressive disclosure** — injects only root `ENTRY.md` and descends by relevance (payload bounded by branch count) vs OpenWiki's static pointer + ad-hoc page reads.
5. **Fact-grained, evolvable nodes** with `kind`/tags/typed edges/id-stable relocation/redirects and an explicit **no-auto-resolve conflict workflow** vs OpenWiki silently rewriting prose.
6. **Multi-harness portability** (5 harnesses, one format) vs single-tool.
7. **Open OKF v0.1 bundle** vs bespoke markdown + private `.last-update.json`.
