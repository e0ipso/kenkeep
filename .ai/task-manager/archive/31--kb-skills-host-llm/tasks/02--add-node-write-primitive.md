---
id: 2
group: "cli-primitives"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - typescript
  - unit-testing
---
# Add `node write` CLI primitive (folds state-mark in)

## Objective
Add a new `ai-kb node write <kind> <slug> --from <path>` command that performs an atomic, Zod-validated node write (tmp + rename) with slug-collision resolution, and — when invoked with `--source-doc <relpath> --source-hash <sha256>` — folds the bootstrap-state hash-map update into the same atomic transaction. Replaces the LLM-driven interactive flow currently in `src/commands/node-add.ts` for headless / skill-driven use.

## Skills Required
- `typescript` — implement the new commander subcommand on top of `src/lib/fs-atomic.ts` and `src/lib/nodes.ts`.
- `unit-testing` — cover the slug-collision and state-map folding behavior.

## Acceptance Criteria
- [ ] New file `src/commands/node-write.ts` (or `src/commands/node/write.ts` matching the existing `node` namespace) registered with `commander`.
- [ ] Accepts node body content on stdin **or** via a file path argument (`--from <path>`); choose one or support both, document either way.
- [ ] Validates the resulting frontmatter against the existing Zod schema (`src/lib/schemas.ts`) before writing; nonzero exit + clear stderr on validation failure with no file produced.
- [ ] Uses `src/lib/fs-atomic.ts` for the atomic tmp + rename write.
- [ ] Slug collisions resolved via `ensureUniqueId` (`src/lib/nodes.ts:176`); emits the final slug to stdout so callers can record it.
- [ ] When `--source-doc <relpath>` and `--source-hash <sha256>` are both provided, the same invocation also updates `state.json`'s per-file hash map atomically — no separate `state mark` step. Updating one without the other is an error.
- [ ] Tests cover: (a) happy path, (b) slug collision returns a `-2` / counter-suffixed slug, (c) invalid frontmatter is rejected with no partial file, (d) state-map update lands when the source-doc flags are passed and is skipped when they are not.
- [ ] No `proper-lockfile`, no sub-agent spawn, no LLM call.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse: `ensureUniqueId` in `src/lib/nodes.ts:176`, `src/lib/fs-atomic.ts` for atomic writes, `src/lib/schemas.ts` for validation, `src/lib/state.ts` for the typed read/write of `state.json` (but bypass any `proper-lockfile` calls — those are being removed in Task 6 anyway; for now route the state mutation through a path that does the validated tmp+rename without taking the lock).
- The CLI flag names must match what the rewritten `kb-bootstrap` and `kb-add` skills will invoke in Task 4 — keep them stable.

## Input Dependencies
None — pure primitive.

## Output Artifacts
- `ai-kb node write` CLI command used by Task 4 (skill rewrite); both `kb-bootstrap` (per-doc) and `kb-add` (single capture) call it.
- Folded state-mark behavior that lets Task 6 remove the standalone state-marking pathway from the deleted runner without losing functionality.

## Implementation Notes
<details>
<summary>Details</summary>

- The plan explicitly chose **not** to introduce a separate `state mark` command — the per-file hash-map update rides on the same atomic write as the node body. Concretely, when both flags are passed: write the node file via tmp+rename; then read+validate+update `state.json` via tmp+rename. Two writes, both atomic individually. If the second fails, the node file is left on disk and the caller will see a nonzero exit — the next bootstrap run will simply see "node exists but no hash recorded" and recompute, which is the desired safe failure mode.
- Slug collision behavior: today's `ensureUniqueId` appends `-2`, `-3`, etc. Preserve that exactly so node filenames remain predictable.
- Do not re-implement validation; call into the existing Zod parser. If the parser surface needs a small refactor to be reusable outside the interactive command, do that here.
- Keep the existing interactive `ai-kb node add` command alive in this task — it is still used by humans at a TTY. Task 5 turns it into a launcher. This task only adds the headless primitive sibling.
- Stdout contract: on success, print the final resolved slug (and nothing else to stdout) so the skill can capture it via `Bash` output and use it in subsequent steps.
- Tests live next to existing CLI integration tests; use a tmpdir as the project root.

</details>
