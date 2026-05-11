---
title: Architecture
nav_order: 8
has_children: false
permalink: /architecture/
---

# Architecture

Aimed at contributors to `@e0ipso/ai-knowledge-base` and at future adapter authors who want to add support for AI assistants beyond Claude Code. For day-to-day usage, read [Core Concepts > How it works](../core-concepts/how-it-works.md) instead.

## Layout

```
src/
├── cli.ts                       # Commander entry point — wires CLI subcommands
├── commands/                    # User-facing CLI command implementations
│   ├── init.ts
│   ├── doctor.ts
│   ├── status.ts
│   ├── curate.ts
│   ├── node-add.ts
│   ├── proposals-review.ts
│   ├── bootstrap-incremental.ts
│   └── index-rebuild.ts
├── hooks/                       # Compiled-to-.mjs hook scripts
│   ├── kb-capture.ts            # Stop / SessionEnd / PreCompact (stage-1)
│   ├── kb-stage2-drain.ts       # SessionStart, async (stage-2)
│   └── kb-session-start.ts      # SessionStart, sync (consume injection)
├── lib/                         # Pure-ish reusable building blocks
│   ├── schemas.ts               # All Zod schemas (`schema_version: 1` everywhere)
│   ├── paths.ts                 # repoPaths, packageRoot, findRepoRoot
│   ├── log.ts                   # Console logger (NO_COLOR-aware)
│   ├── transcript.ts            # Parse Claude Code JSONL into role-tagged strings
│   ├── gitleaks.ts              # Run gitleaks; redact findings
│   ├── dedup-cache.ts           # SHA-256 dedup window for stage-1
│   ├── queue.ts                 # Atomic `.queue.json` writes
│   ├── session-log.ts           # Render/write session log markdown
│   ├── capture.ts               # Top-level stage-1 orchestration
│   ├── state.ts                 # `state.json` + named locks (PID + TTL)
│   ├── headless.ts              # `claude -p` runner with stream-json + Zod validation
│   ├── stage2-drain.ts          # Stage-2 queue drain
│   ├── curate.ts                # Curator batching + proposal write
│   ├── nodes.ts                 # Node walks + nodes_hash + slugify + proposal writes
│   ├── index-gen.ts             # INDEX.md + GRAPH.md deterministic generation
│   ├── ulid.ts                  # ULID for run-ids
│   ├── bootstrap.ts             # Bootstrap-incremental pipeline
│   ├── session-start.ts         # Consume-hook payload builder
│   └── version.ts               # package.json version reader
├── adapters/
│   ├── types.ts                 # Adapter interface (v1 placeholder for multi-assistant)
│   └── claude.ts                # Claude Code adapter (only v1 implementation)
└── templates-source/            # Files copied verbatim into consumer repos
    ├── prompts/                 # stage-2-extract.md, curator.md, bootstrap-incremental.md
    ├── claude/                  # .claude/commands/* + settings.json scaffolding
    ├── knowledge-base/          # .ai/knowledge-base/* scaffolding
    └── precommit/               # pre-commit-config.yaml shipped to consumers
```

`tsup` builds two outputs:

- `dist/cli.js` — the CLI binary (single ESM file with shebang).
- `dist/hooks/*.mjs` — one bundle per hook script. `.mjs` extension means consumers don't need a `package.json` in the hooks dir.

The `prepare` lifecycle (`npm install`, `npm publish`) runs `scripts/build-templates.mjs` which copies `templates-source/` into `templates/` and drops the compiled hooks into `templates/claude/hooks/`. The npm package ships `dist/` and `templates/` (see the `files` field in `package.json`).

## Three pipelines, four hooks, two CLI shapes

The system is three deliberately separate pipelines (capture, curate, consume) with four Claude Code hooks wiring them in. Each pipeline can be disabled by removing its hook entry — `init --force` re-registers them.

```
Stop / SessionEnd / PreCompact  →  kb-capture       (sync, ≤1 s)
SessionStart                    →  kb-stage2-drain  (async)
                                →  kb-session-start (sync, ≤1 s)
```

The two CLI shapes:

- **Deterministic CLIs** (`init`, `doctor`, `status`, `node add`, `index rebuild`, `proposals review`) — no LLM, no subprocess. Pure code over filesystem state.
- **LLM-invoking CLIs** (`curate`, `bootstrap-incremental`) — spawn `claude -p` via `runHeadlessClaude`, parse stream-JSON output, validate against Zod. All subprocesses get `KB_BUILDER_INTERNAL=1` so the spawned Claude doesn't fire our hooks recursively.

## State files

| File | Owner | Purpose |
|---|---|---|
| `.ai/knowledge-base/_sessions/<log>.md` | capture + stage-2 + curator | Per-session checkpoint; frontmatter tracks stage_2 status, gitleaks status, curator processed marker. |
| `.ai/knowledge-base/_sessions/.queue.json` | capture + drain | Atomic stage-1 → stage-2 handoff queue. |
| `.ai/knowledge-base/_sessions/.dedup-cache.json` | capture | 5-minute SHA-256 window so back-to-back Stop/SessionEnd/PreCompact don't double-capture. |
| `.ai/knowledge-base/_logs/{stage-2,curator,bootstrap-incremental}/*.jsonl` | stage-2 + curator + bootstrap | Stream-JSON traces of every `claude -p` invocation. Gitignored. |
| `.ai/knowledge-base/_proposed/{additions,modifications,contradictions}/` | curator + node-add + bootstrap | Pending proposals awaiting review. |
| `.ai/knowledge-base/nodes/{practice,map}/` | proposals review | Canonical, accepted knowledge. The only thing the assistant sees via INDEX. |
| `.ai/knowledge-base/INDEX.md`, `GRAPH.md` | curator + index-rebuild | Deterministic outputs derived from `nodes/`. INDEX is token-budgeted; GRAPH is the full edge listing. |
| `.ai/.kb-builder/installed-version` | init | Marker recording package version + selected assistants. Committed. |
| `.ai/.kb-builder/state.json` | drain + curator + bootstrap + consume | Single shared state file. `lock` (one at a time) + `last_nudged_at`. Gitignored. |
| `.ai/.kb-builder/bootstrap-state.json` | bootstrap | SHA-256 of every doc the bootstrap pipelines have processed. Gitignored. |
| `.ai/.kb-builder/prompts/*` | init | Local overrides for the three shipped prompts. Committed. |

## Locking

`state.json` holds one lock at a time. Each pipeline takes its own named lock (`name: <pipeline>`, `pid`, `acquired_at`, `ttl_ms`). 30-minute TTL; an older lock is treated as stale and reclaimed. The pipelines that need the lock:

- `stage2-drain` — prevents two concurrent SessionStart drains from racing on the queue.
- `curator` — prevents two concurrent curate runs from writing duplicate proposals.
- `bootstrap-incremental` — prevents two concurrent bootstraps from writing duplicate proposals.

The consume hook does **not** lock — it only reads INDEX and writes `last_nudged_at`, both of which are fine to clobber.

## Schema versioning

Every YAML frontmatter shape and every JSON state file carries `schema_version: 1`. v1 → v2 will ship a migration script under `src/lib/migrations/`. The runtime fails closed on shapes it can't validate (returns "no data" rather than guessing), so a stale-schema file in the wild can be detected by `doctor` rather than silently corrupted.

## Adapter interface

`src/adapters/types.ts` defines an `Adapter` interface intended to make adding non-Claude assistants tractable in v2:

```ts
interface Adapter {
  name: string;
  hookInstallPath(): string;
  commandInstallPath(): string;
  writeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void>;
  readTranscript(hookInput: unknown): Promise<RoleTaggedTranscript>;
  runHeadless<T>(promptBody: string, stdin: string, schema: ZodSchema<T>, opts?: HeadlessOpts): Promise<T>;
  renderSlashCommand(spec: SlashCommandSpec): string;
}
```

Adding a new adapter is mostly mechanical: implement these five methods (`name`, `hookInstallPath`, `commandInstallPath`, `writeHookConfig`, `readTranscript`, `runHeadless`, `renderSlashCommand`) and add the adapter to the dispatch in `init.ts`. The hook scripts themselves are not adapter-specific — they parse hook input via the adapter's `readTranscript`, so the transcript-format details are hidden. v1 ships the Claude adapter only.

## Determinism contract

The non-LLM parts of the system are deterministic:

- `computeNodesHash` is a content-addressed walk; same `nodes/` → same hash, regardless of mtime or filesystem.
- `generateIndex` and `generateGraph` are pure functions of `nodes/` plus a `now` injection (used for `generated_at`). Two calls at the same instant produce byte-identical output.
- `slugify`, `deriveNodeId`, and `ensureUniqueId` are pure.
- ULID generation is the only randomness path on the hot path; it's confined to `run_id` minting (curator + bootstrap) where uniqueness, not reproducibility, is the goal.

Tests rely on this: see `tests/lib/index-gen.test.ts` for golden-file comparisons.

## Testing strategy

Three layers, each catching a different class of regression. Together they cover the system without making every PR pay for the slowest one.

### Unit + integration (default `npm test`)

```sh
npm test               # vitest run, all 24+ test files
```

Includes:

- **Pure-function tests** for every `src/lib/` module — frontmatter parsers, Zod schemas, INDEX generator (golden-file), `nodes_hash`, dedup cache, gitleaks parser, queue atomic-write, lock TTL, stale-INDEX detection, role-tagged transcript splitter, stream-json line parser, settings resolver, duration parser, logs-prune walker.
- **Integration tests** for every LLM-invoking pipeline (`stage2-drain`, `curate`, `bootstrap`) using the `Stage2Runner` / `CuratorRunner` / `BootstrapRunner` seams: tests inject a fake runner that returns the schema-shaped JSON directly, bypassing the `claude -p` subprocess entirely. The seam is the same one the real `ClaudeAdapter.runHeadless` plugs into, so the pipeline code path is exercised in full — only the subprocess is faked.
- **CLI integration tests** that build the package, run the actual binary against a temp-directory sandbox, and assert on stdout, exit codes, and filesystem state. See `tests/init.test.ts`, `tests/upgrade.test.ts`, `tests/doctor.test.ts`, `tests/logs-prune.test.ts`.

These run on every PR; the suite finishes in ~10 seconds locally.

### Real-`claude` end-to-end (`tests/e2e/`)

Gated behind `KB_RUN_REAL_CLAUDE=1` so the default test run never spawns subprocesses against the Anthropic API. When enabled, `tests/e2e/full-cycle.test.ts` exercises one full cycle on a synthetic repo:

1. `ai-knowledge-base init` populates a temp directory.
2. A fixture session log carrying the bravo-insider transcript lands in `_sessions/` with `stage_2_status: pending`.
3. `drainStage2Queue` runs against the real `claude -p` with the shipped stage-2 prompt and a 5-minute timeout.
4. `runCurate` runs against the real `claude -p` with the shipped curator prompt.
5. The proposals-review TUI's "accept all" path (via the `actions` test seam) promotes every proposal into `nodes/`.
6. `ai-knowledge-base index rebuild` produces `INDEX.md`.
7. The test asserts at least one node exists and that either a node or `INDEX.md` mentions "Bravo Insider" — a project-unique substring from the fixture transcript.

The assertion is intentionally loose (any haystack matches) so that minor wording drift between Claude model versions doesn't break it. If it regresses, the failing run leaves the stream-json logs under the temp sandbox's `_logs/stage-2/` and `_logs/curator/` for inspection.

The suite is run manually via the `E2E (real-claude)` GitHub Actions workflow (`workflow_dispatch`-only). The workflow installs `@anthropic-ai/claude-code` globally and authenticates via `ANTHROPIC_API_KEY`. See [`CONTRIBUTING.md`](https://github.com/e0ipso/ai-knowledge-base/blob/main/CONTRIBUTING.md#real-claude-e2e-suite) for when to trigger it.

### Manual testing

[Manual test plan](../manual-test-plan.md) covers tests that resist automation: PreCompact timing on long sessions, hook installation on Windows, vendored gitleaks binary on each platform, and real session-capture quality. These are exercises performed before a significant release.

### Mocking strategy summary

| What | How | Why |
|---|---|---|
| `claude -p` subprocess in unit tests | Fake `Stage2Runner`/`CuratorRunner`/`BootstrapRunner` returning schema-shaped JSON | Pipeline code is exercised; no API spend or determinism worries. |
| `claude -p` subprocess at the spawn layer | `SpawnFn` seam in `runHeadlessClaude` | Lets us test the `headless.ts` parser against handcrafted stream-json fragments without process startup cost. |
| File system | Sandbox temp directory + `cleanSandbox()` | No global state leakage between tests. |
| `claude` CLI for E2E | Real binary, gated by env var | Catches prompt regressions, CLI flag drift, and model-output-shape surprises that the JSON-shaped mocks can't see. |

## What's intentionally not here

Per [IMPLEMENTATION §12](https://github.com/e0ipso/ai-knowledge-base/blob/main/IMPLEMENTATION.md#12-implementation-phases):

- **No multi-assistant adapter dispatch.** v2.
- **No `bootstrap-incremental` overlap detection.** v2 (always writes additions; reviewer rejects duplicates).
- **No managed-MCP injection.** The INDEX-as-additionalContext pattern is the entire injection surface.
- **No auto-prune of `_logs/`.** v1.5 ships `ai-knowledge-base logs prune` as the manual valve; a future release may automate it via `settings.logsRetentionDays`.

These are constraints, not omissions. Each one trades expressiveness for "the code is easy to read end-to-end in an afternoon."

## Where to extend

| You want to… | Look at… |
|---|---|
| Change extraction behavior | `templates-source/prompts/stage-2-extract.md` (project-tunable copy at `.ai/.kb-builder/prompts/stage-2-extract.md`). |
| Change curator behavior | `templates-source/prompts/curator.md`. Tighten the dedup or contradiction logic in `src/lib/curate.ts`. |
| Change bootstrap behavior | `templates-source/prompts/bootstrap-incremental.md` for the CLI prompt; `templates-source/claude/commands/kb-bootstrap.md` for the in-session agent. |
| Add a new CLI subcommand | `src/commands/<name>.ts` + wire it in `src/cli.ts`. Add doc to `docs/reference/cli.md`. |
| Add a new hook | `src/hooks/<name>.ts` + entry in `tsup.config.ts` + register in `src/commands/init.ts`. Doc in `docs/reference/hook-events.md`. |
| Add a new state file | Schema in `src/lib/schemas.ts` (with `schema_version: 1`); read/write helpers next to the existing patterns. Add to `.gitignore` block in `src/commands/init.ts`. |
| Add a new adapter | Implement `src/adapters/types.ts`'s interface. Update `src/commands/init.ts` to dispatch on the assistant list. |
