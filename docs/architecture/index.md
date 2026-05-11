---
title: Architecture
nav_order: 8
has_children: false
permalink: /architecture/
---

# Architecture

For contributors and adapter authors. Day-to-day usage lives in [Core Concepts > How it works](../core-concepts/how-it-works.md).

## Layout

```
src/
├── cli.ts                       # Commander entry
├── commands/                    # User-facing CLI implementations
├── hooks/                       # Compiled-to-.mjs hook scripts
│   ├── kb-capture.ts            # stage-1 (Stop/SessionEnd/PreCompact)
│   ├── kb-stage2-drain.ts       # stage-2 (SessionStart, async)
│   └── kb-session-start.ts      # consume (SessionStart, sync)
├── lib/                         # Reusable building blocks
├── adapters/                    # Adapter interface (v1: Claude only)
└── templates-source/            # Files copied into consumer repos
```

`tsup` builds `dist/cli.js` (CLI binary) and `dist/hooks/*.mjs` (one bundle per hook). The `prepare` script (`scripts/build-templates.mjs`) copies `templates-source/` to `templates/` and drops compiled hooks into `templates/claude/hooks/`. The npm package ships `dist/` and `templates/`.

## Two CLI shapes

- **Deterministic**: `init`, `doctor`, `status`, `node add`, `index rebuild`, `proposals review`. No LLM, pure filesystem operations.
- **LLM-invoking**: `curate`, `bootstrap-incremental`. Spawn `claude -p` via `runHeadlessClaude`, parse stream-JSON, validate with Zod. All subprocesses set `KB_BUILDER_INTERNAL=1`.

## State files

| File | Owner | Purpose |
|---|---|---|
| `_sessions/<log>.md` | capture, stage-2, curator | Per-session checkpoint. |
| `_sessions/.queue.json` | capture, drain | Stage-1 → stage-2 handoff. |
| `_sessions/.dedup-cache.json` | capture | 5-min SHA-256 window. |
| `_logs/{stage-2,curator,bootstrap-incremental}/*.jsonl` | LLM pipelines | Stream-JSON traces. Gitignored. |
| `_proposed/{additions,modifications,contradictions}/` | curator, node-add, bootstrap | Pending proposals. |
| `nodes/{practice,map}/` | proposals review | Canonical accepted knowledge. |
| `INDEX.md` / `GRAPH.md` | curator, index-rebuild | Deterministic outputs derived from `nodes/`. |
| `.state/installed-version` | init | Package version + selected assistants. Committed. |
| `.state/state.json` | drain, curator, bootstrap, consume | Lock + `last_nudged_at`. Gitignored. |
| `.state/bootstrap-state.json` | bootstrap | Doc SHA-256 cache. Gitignored. |
| `.state/prompts/*` | init | Local prompt overrides. Committed. |

## Locking

`state.json` holds one lock at a time (`name`, `pid`, `acquired_at`, `ttl_ms`). 30-min TTL; stale locks are reclaimed.

- `stage2-drain`: prevents concurrent SessionStart drains racing on the queue.
- `curator`: prevents duplicate proposals from concurrent curate runs.
- `bootstrap-incremental`: same, for bootstrap.

Consume doesn't lock. It only reads INDEX and writes `last_nudged_at`.

## Determinism contract

- `computeNodesHash` is content-addressed and mtime-independent.
- `generateIndex` / `generateGraph` are pure functions of `nodes/` plus an injected `now` (for `generated_at`).
- `slugify`, `deriveNodeId`, `ensureUniqueId` are pure.
- ULID is the only randomness, scoped to `run_id` minting (uniqueness, not reproducibility).

Tests rely on this. See `tests/lib/index-gen.test.ts` for golden-file comparisons.

## Adapter interface

`src/adapters/types.ts`:

```ts
interface Adapter {
  name: string;
  hookInstallPath(): string;
  skillInstallPath(): string;
  writeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void>;
  readTranscript(hookInput: unknown): Promise<RoleTaggedTranscript>;
  runHeadless<T>(promptBody: string, stdin: string, schema: ZodSchema<T>, opts?: HeadlessOpts): Promise<T>;
  renderSkill(spec: SkillSpec): string;
}
```

Adding a new adapter: implement the methods, dispatch from `init.ts`. Hook scripts read transcripts via the adapter so format details stay hidden. v1 ships Claude only.

## Testing

Three layers:

- **Unit + integration** (`npm test`): pure-function tests for everything in `src/lib/`, plus pipeline integration tests that inject a fake runner (the same seam `ClaudeAdapter.runHeadless` plugs into). CLI integration tests build the package and run the binary in a temp-dir sandbox. Finishes in ~10s.
- **Real-claude E2E** (`tests/e2e/`, gated by `KB_RUN_REAL_CLAUDE=1`): full cycle on a synthetic repo against the real `claude` CLI. Run before release.
- **Manual**: see [manual-test-plan.md](../manual-test-plan.md) for things that resist automation (Windows hook install, PreCompact timing, capture quality judgment).

## What's intentionally not here

- Multi-assistant adapter dispatch (v2).
- Bootstrap-incremental overlap detection (v2).
- Managed-MCP injection. INDEX-as-additionalContext is the entire injection surface.
- Auto-prune of `_logs/`. `logs prune` is the manual valve.

## Where to extend

| Goal | Path |
|---|---|
| Change extraction | `templates-source/prompts/stage-2-extract.md` |
| Change curator | `templates-source/prompts/curator.md` (logic in `src/lib/curate.ts`) |
| Change bootstrap | `templates-source/prompts/bootstrap-incremental.md` or skill body |
| New CLI subcommand | `src/commands/<name>.ts` + wire in `src/cli.ts` + doc in `docs/reference/cli.md` |
| New hook | `src/hooks/<name>.ts` + `tsup.config.ts` + register in `init.ts` |
| New state file | Schema in `src/lib/schemas.ts`; add to gitignore block |
| New adapter | Implement `src/adapters/types.ts`; dispatch from `init.ts` |
