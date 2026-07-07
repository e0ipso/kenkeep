---
id: 1
group: "core"
dependencies: []
status: "completed"
created: 2026-07-07
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "Git-history recency ranking, per-node baseline resolution, and conservative body path extraction must all be deterministic, bounded to a constant number of git calls, and fail-open on any git error."
---
# Freshness core engine and node→code path mapping

## Objective
Add a shared, deterministic, LLM-free module `src/lib/freshness.ts` that, given the repo root and nodes directory, returns a structured `FreshnessReport` identifying which leaf nodes may describe source code that changed since the node was last curated. Baselines are derived from git history (no stamp, no state); the node→code mapping is the union of body-referenced tracked paths and tracked `kk_derived_from` entries.

## Skills Required
TypeScript module design with shell-free `git` invocation (`execFileSync`), and Vitest against real temporary git-repo fixtures.

## Acceptance Criteria
- [ ] `src/lib/freshness.ts` exports a single entry point (e.g. `computeFreshness({ root, nodesDir }): FreshnessReport`) and a `FreshnessReport` type carrying: `consideredNodes` (number), `flaggedCount` (number), `flaggedNodeIds` (string[], stable-sorted), `perBranch` (array of `{ branch: string; flagged: number }`, stable-sorted), and, per flagged node, the changed referenced path(s).
- [ ] Baseline: each node's baseline is the most recent commit that touched the node's own file. A node whose file has no commit (brand-new / uncommitted) has no baseline and is **not** flagged.
- [ ] Mapping: a node's referenced paths are the union of (a) repo-relative POSIX path tokens extracted from the node body (Markdown link targets and inline-code spans) that resolve to a **git-tracked** file, and (b) `kk_derived_from` entries that resolve to a git-tracked repo path. URLs, bare `_sessions/*.md` filenames, and tokens that do not resolve to a tracked file contribute nothing.
- [ ] Flag rule: a node is flagged iff any of its referenced paths changed in `<baseline>..HEAD` — i.e. that path's most-recent-change commit is newer than the node's baseline commit.
- [ ] Bounded git usage: the implementation performs a small **constant** number of git invocations regardless of node count (rank commits by recency once; one `git log --name-only`/`--name-status` pass to derive per-path most-recent-change and per-node baseline). No per-node git subprocess.
- [ ] Fail-open: a non-git working tree, any `git` error, a shallow/truncated-history gap, or an empty/unreadable `nodes/` tree yields an empty (`flaggedCount: 0`) report and **never throws**.
- [ ] Deterministic output: node and branch orderings are stable and contain no timestamps.
- [ ] `npm test -- <the new freshness core suite>` exits 0, proving: path-changed-after-baseline is flagged; path-changed-before-baseline is not; URL/session-only/untracked-only provenance is not flagged; brand-new uncommitted node is not flagged; non-git tree returns an empty report without throwing.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow the established git pattern: `execFileSync('git', [...args], { cwd: root, stdio: 'pipe' })`; never pass a shell string; treat a non-zero exit / thrown error as "no signal".
- Load nodes with `readAllNodes(nodesDir)` from `src/lib/nodes.ts` (`NodeFile { path, relPath, relDir, frontmatter, body }`). `frontmatter.kk_id` and `frontmatter.kk_derived_from` are available.
- Reuse the tracked-path classification idea from `doctor`'s `resolvesOnDisk`/`collectDanglingDerivedFrom` but gate on git-**tracked** membership (e.g. compare against `git ls-files`), not raw `existsSync`, so untracked scratch files are ignored.
- `branch` for `perBranch` is the top-level segment of a node's `relDir` (root-level leaves group under a stable label such as `(root)`).
- Do not introduce a schema-version bump, a new persisted state file, or any write to `nodes/`. Read-only.

## Input Dependencies
None. This is the foundational module.

## Output Artifacts
`src/lib/freshness.ts` (core engine + body path extraction) and its Vitest suite. Tasks 2, 3, and 4 consume `computeFreshness`/`FreshnessReport`.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow the RED → GREEN → REFACTOR cycle for the meaningful logic below.
2. Recency ranking: `git log --format=%H HEAD` gives commits newest-first; map each sha to its index (0 = HEAD). A single `git log --format=<sentinel %H> --name-only HEAD` (or `--name-status`) pass lets you record, for every path, the index of the newest commit that touched it, and likewise the newest commit touching each node file. This is the "constant number of git calls" core — do not loop git per node.
3. Node baseline = recorded newest-commit index for the node's file path (relative to `root`). Referenced-path change index = recorded newest-commit index for that path. Flag when any referenced path index `<` node baseline index (strictly newer). Equal or greater means the node was curated at/after that change → fresh.
4. Rename handling: prefer following renames where practical so a node's baseline tracks content history across rebalance moves; a rename-only reset is acceptable (conservative, fewer false positives).
5. Body path extraction must be conservative: only tokens that resolve to a tracked file count. Prefer building the tracked-file set once (`git ls-files`) and testing membership. Normalize `./`-prefixes and both `.ai/kenkeep/...`-from-root and repo-root-relative forms.
6. Fail-open everywhere: wrap git calls so any failure returns an empty report. Add a test that runs the engine in a `mkdtemp` directory that is not a git repo and asserts no throw + empty report.
7. Test philosophy — write a few tests, mostly integration. Build a real temp git repo fixture (init, commit a node file, commit a source file, reorder commits) and assert the flag/no-flag business logic and the fail-open path. Do not test git itself or gray-matter.
</details>
