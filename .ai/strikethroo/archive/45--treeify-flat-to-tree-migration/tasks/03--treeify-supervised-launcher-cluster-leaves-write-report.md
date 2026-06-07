---
id: 3
group: "treeify-core"
dependencies: [1, 2]
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 7
complexity_notes: "Supervised LLM launcher that execs the host harness for clustering, wires deterministic detection + write primitives, triggers Plan 1's rebuild, and emits a placement report while never committing; the orchestration seam of the migration."
---
# Treeify supervised launcher: cluster flat leaves into topical folders, write placements, rebuild indexes, and report

## Objective
Implement the `treeify` command/launcher that performs the one-time supervised migration end to end, mirroring the bootstrap launcher model. It calls the layout detector (Task 2) and refuses on an already-migrated tree; otherwise it reads the existing flat leaves, execs the host harness in `-p` mode to cluster the leaves into an initial topical folder structure (reusing Plan 4's clustering judgment), hands the resulting `{ id, sourcePath, targetFolder }` placements to the deterministic write primitive (Task 1), invokes Plan 1's deterministic `index-rebuild` to generate the index nodes / `GRAPH.md` / `nodes_hash`, prints a migration report listing every leaf and its assigned folder, and then stops. It writes to disk only; the human reviews by git diff and accepts by commit or rejects by restore. It never overwrites without review and never commits.

## Skills Required
- `typescript`: add a launcher command (mirroring `src/lib/launch-skill.ts` / `src/lib/bootstrap.ts` / `src/commands/bootstrap.ts`) that execs the host harness with the recursion guard, parses the clustering result, and orchestrates the deterministic primitives.

## Acceptance Criteria
- [ ] A new `treeify` entry point exists (e.g. `src/commands/treeify.ts` wired into the CLI, with launcher logic in `src/lib/treeify.ts` or a sibling) and is reachable as a command (e.g. `node dist/cli.js treeify`).
- [ ] On start it calls `detectKbLayout(...)` from Task 2; if the verdict is `"tree"` (already migrated) it surfaces the friendly refusal message and exits making zero filesystem changes.
- [ ] On a flat KB it reads every flat leaf, execs the host harness in `-p` mode to cluster the leaves into topical folders, and parses the returned placements into the `TreeifyPlacement[]` shape consumed by Task 1.
- [ ] The child harness invocation sets `KENKEEP_BUILDER_INTERNAL=1` (`practice-recursion-guard-kenkeep-builder-internal`).
- [ ] Clustering reuses Plan 4's clustering judgment/prompt rather than inventing a divergent scheme; the launcher only proposes the initial folders.
- [ ] It passes the placements to `writeTreeifyPlacements(...)` (Task 1), then invokes Plan 1's deterministic `index-rebuild` (see `src/commands/index-rebuild.ts` / `src/lib/index-gen.ts`) to generate index nodes, `GRAPH.md`, and `nodes_hash`.
- [ ] It prints a migration report listing every leaf id and the folder it was placed in (covers plan Success Criterion 6).
- [ ] It never stages, never commits, and never invokes git; it writes files and stops for human review (covers plan Success Criterion 4).
- [ ] No em dashes in changed files (`practice-no-em-dashes`). `npm run typecheck` and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow the launcher/primitive split: this launcher does the LLM work (clustering) and orchestration; all deterministic file writing is delegated to Task 1's primitive and all index generation to Plan 1's rebuild. Do not re-implement writing or generation here.
- Reuse the host-harness `-p` invocation pattern already used by the bootstrap launcher (`src/lib/launch-skill.ts` / `src/lib/bootstrap.ts`); reuse the existing JSON-extraction helper (`src/lib/json-extract.ts`) to parse the clustering result robustly.
- Do not run in CI: the launcher execs the host harness and the LLM and is human-supervised (plan Notes).
- Ids are the anchor: the launcher must pass ids straight through to placements; it must not synthesize or remap ids.
- If clustering returns a placement that the detector/primitive cannot honor (e.g. unknown id or existing target), surface the error and make no partial commit; rely on Task 1's all-or-nothing write contract.

## Input Dependencies
- Task 1: `writeTreeifyPlacements(...)` deterministic write primitive and the `TreeifyPlacement` type.
- Task 2: `detectKbLayout(...)` and the already-migrated refusal.

## Output Artifacts
- New `src/commands/treeify.ts` (CLI command) and launcher logic in `src/lib/treeify.ts` (or sibling), wired into the CLI dispatcher.
- Reuse of Plan 1's `index-rebuild` invocation from the migration flow.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/lib/launch-skill.ts`, `src/lib/bootstrap.ts`, `src/commands/bootstrap.ts`, `src/lib/json-extract.ts`, `src/commands/index-rebuild.ts`, and `src/lib/index-gen.ts` to learn how an existing launcher execs the host harness in `-p` mode, sets the recursion guard, parses the LLM JSON result, and how Plan 1's rebuild is invoked programmatically.
2. Add the CLI command `treeify` in `src/commands/treeify.ts` and register it in the CLI dispatcher (wherever `bootstrap` / `index-rebuild` are registered).
3. Flow:
   - Resolve the KB root via `src/lib/paths.ts`.
   - Call `detectKbLayout(root)` (Task 2). If `"tree"`, print the refusal message and exit non-zero-but-clean with zero writes. If `"empty/unknown"`, report nothing to migrate and exit. If `"flat"`, continue.
   - Read all flat leaves (ids + edges) using `src/lib/nodes.ts`.
   - Build the clustering prompt reusing Plan 4's clustering judgment (locate Plan 4's clustering prompt/skill and reuse it; do not author a new scheme). Exec the host harness in `-p` mode with `KENKEEP_BUILDER_INTERNAL=1` set on the child env, exactly as the bootstrap launcher does.
   - Parse the harness output with `json-extract.ts` into `TreeifyPlacement[]` (`{ id, sourcePath, targetFolder }`).
   - Call `writeTreeifyPlacements(root, placements)` (Task 1). It is all-or-nothing and never overwrites.
   - Invoke Plan 1's deterministic `index-rebuild` to generate index nodes, `GRAPH.md`, and `nodes_hash`.
   - Print a migration report: one line per leaf, `id -> targetFolder`.
4. Never call git, never stage, never commit. Write files and stop; the human reviews by `git diff` and accepts by commit or rejects by `git restore`.
5. Keep all changed files free of em dashes. Run `npm run typecheck && npm run lint`.

</details>
