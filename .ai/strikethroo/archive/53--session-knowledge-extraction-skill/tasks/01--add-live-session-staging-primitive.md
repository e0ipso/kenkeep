---
id: 1
group: "session-knowledge-extraction"
dependencies: []
status: "completed"
created: 2026-06-20
skills:
  - typescript
  - cli-primitives
complexity_score: 8
complexity_notes: "Adds a new deterministic write primitive across session-log helpers, strict proposal schema validation, UUID-v4 fallback reporting, private-span stripping, atomic writes, CLI wiring, and focused command tests."
---
# Add live proposal session-log staging primitive

## Objective
Add a deterministic `session-log stage-live` primitive that validates live-session proposal JSON and creates or updates a normal `_sessions/*.md` log with `proposal_status: done`, so `/kk-session-extract` can reuse the existing curation pipeline without hand-editing session logs.

## Skills Required
- `typescript` - implement reusable session-log staging logic and schema-safe frontmatter writes.
- `cli-primitives` - wire the command into the `session-log` CLI group and keep it deterministic and LLM-free.

## Acceptance Criteria
- [ ] `node dist/cli.js session-log stage-live` (or the equivalent built CLI invocation in tests) reads proposal JSON from stdin, validates it with the current strict `ProposalOutputSchema`, and fails clearly without writing on invalid input.
- [ ] The primitive creates or updates a session log under `.ai/kenkeep/_sessions/` using `findSessionLogBySessionId`, `buildSessionLogFilename`, and `renderSessionLog` or factored equivalents where practical.
- [ ] Written frontmatter includes `schema_version: 1`, resolved `session_id`, `captured_by: manual`, `captured_at`, `proposal_completed_at`, `transcript_hash`, `proposal_status: done`, and populated `proposals.practice` / `proposals.map`.
- [ ] Writes use the repo's tmp+rename atomic helper (`atomicWriteFile` or an equivalent existing helper), and the command prints a one-line machine-readable summary containing the resolved session log path, `session_id`, and whether idempotency is normal or degraded.
- [ ] The primitive requires a UUID-v4 `--session-id` when supplied, or supports an explicit generated UUID-v4 fallback mode (for example `--generate-session-id`) for runtimes that cannot expose the live id; hook UUID validation is not weakened.
- [ ] Any staged transcript/evidence body strips `<kk-private>...</kk-private>` spans before writing, or omits evidence text entirely.
- [ ] Focused tests cover create, update-by-session-id, generated fallback id, invalid JSON/schema failure including rejected legacy hint fields, private-span stripping, and empty-but-valid proposal output.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files likely involved: `src/lib/session-log.ts`, `src/lib/capture.ts` for `stripPrivateSpans` reuse if needed, `src/lib/fs-atomic.ts`, a new or existing `src/commands/session-log-*.ts`, `src/cli.ts`, and `tests/commands/session-log-*.test.ts`.
- Reuse the existing schemas in `src/lib/schemas.ts`; do not introduce a second proposal schema.
- Do not add legacy `supports_existing_node` / `contradicts_existing_node` fields; the current schema is strict and rejects them.
- Do not introduce `topics` as a new frontmatter field unless the implementation deliberately updates the schema and docs in the same change; current code does not require it.
- Keep the command deterministic: no LLM calls, no harness subprocess, no daemon, no external runtime.
- The staged body may be a concise transcript section such as "live context processed by `/kk-session-extract`" plus optional evidence text supplied by the skill; it must not claim to be a full transcript unless provided one.

## Input Dependencies
None.

## Output Artifacts
- A new CLI primitive under the `session-log` command group.
- Reusable session-log helper code for staging validated live proposals.
- Command-level tests proving validation, create/update behavior, and output contract.

## Implementation Notes
This task owns only the deterministic staging boundary. It should not implement the slash skill, curate action drafting, node writing, or capture preservation.

<details>
<summary>Detailed implementation guidance</summary>

1. Inspect `src/commands/session-log-update-proposals.ts`, `src/lib/session-log.ts`, and `tests/commands/session-log-update-proposals.test.ts` before coding; mirror their CLI/test style.
2. Define an explicit command contract. A practical shape is:

   ```sh
   node dist/cli.js session-log stage-live --session-id <uuid-v4> [--transcript-excerpt <path-or-inline-option>]
   node dist/cli.js session-log stage-live --generate-session-id [--transcript-excerpt <path-or-inline-option>]
   ```

   If the final option shape differs, document it in the command description and tests. The command must read proposal JSON from stdin.
3. Validate stdin with `ProposalOutputSchema.safeParse`. On failure, print a concise error and exit non-zero before writing.
4. Resolve the target file by `session_id`: if an existing log exists, update it in place; otherwise build a sortable filename from `captured_at`.
5. Preserve the ordinary session-log contract so `curate-dedup` can consume the staged log unchanged. In particular, use `proposal_status: done` and keep candidate origins able to reference `<session_id>:<practice|map>:<index>`.
6. If the command creates fallback ids, use `crypto.randomUUID()` or the repo's existing UUID source, keep that path explicit, and report degraded idempotency. Do not loosen `assertValidSessionId` for hook code.
7. Use atomic write semantics for both create and update. Existing `writeSessionLog` is a plain write today, so do not assume it already satisfies this requirement.
8. Add tests that inspect the written markdown frontmatter and confirm no partial file is created for invalid input.

</details>
