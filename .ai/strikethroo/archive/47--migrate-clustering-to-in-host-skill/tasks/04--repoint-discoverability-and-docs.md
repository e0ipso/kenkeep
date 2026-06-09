---
id: 4
group: "discoverability"
dependencies: [2]
status: "completed"
created: 2026-06-09
skills:
  - typescript-node-cli
  - technical-writing
---
# Repoint every migration surface from the removed command to the kk-migrate skill

## Objective
Update every surface that previously told users to run
`npx kenkeep --harness <id> migrate` so it instead directs them to run the
`kk-migrate` skill inside their agent session, noting where relevant that full
migration now requires an interactive session (the accepted BC break). This
covers the shared guidance constant, the node reader's v1-rejection error, the
`init`/upgrade older-schema hint, `AGENTS.md`, and the user/AI-facing docs.

## Skills Required
- `typescript-node-cli`: editing the TypeScript guidance constant and its
  consumers so the message no longer names a removed command.
- `technical-writing`: rewriting `AGENTS.md` and the `docs/` pages to describe
  the in-host skill plus deterministic primitive and the loss of headless
  migration.

## Acceptance Criteria
- [ ] `src/lib/migrate-guidance.ts` `MIGRATE_COMMAND_HINT` (and its doc comment)
      is updated to name the `kk-migrate` skill instead of
      `npx kenkeep --harness <id> migrate`. The shared constant remains the
      single source of truth for both the reader and init so they cannot drift.
- [ ] The node reader's `OldLayoutError` message (`src/lib/nodes.ts`) now points
      the user to run the `kk-migrate` skill in their session (with the harness
      caveat), not the removed command.
- [ ] `init`/upgrade's `reportSchemaMismatch` hint (`src/commands/init.ts`) now
      points to the `kk-migrate` skill.
- [ ] `AGENTS.md` (~line 90 migration paragraph) replaces the
      `npx kenkeep --harness <id> migrate` instruction with the in-session
      `kk-migrate` skill flow and the note that migration now requires an
      interactive session.
- [ ] `docs/how-it-works.md`, `docs/internals/schemas.md`, and
      `docs/internals/architecture.md` migration references are updated to
      describe the in-host skill + deterministic primitive and record the removal
      of headless migration. No doc still instructs the reader to run
      `npx kenkeep --harness <id> migrate`.
- [ ] `grep -rn "npx kenkeep --harness <id> migrate" src/ docs/ AGENTS.md`
      returns nothing.
- [ ] `tsc --noEmit`, `eslint .`, and `prettier --check .` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `src/lib/migrate-guidance.ts`: the constant currently is
  `'\`npx kenkeep --harness <id> migrate\`'`. Replace with skill-pointing text,
  e.g. naming the `/kk-migrate` skill and that it runs in the active agent
  session. Update the doc comment that explains the `--harness`-before-subcommand
  rationale (no longer applicable) to describe the skill instead.
- Consumers to keep consistent: `src/lib/nodes.ts` (`OldLayoutError`, imports
  `MIGRATE_COMMAND_HINT`) and `src/commands/init.ts` (`reportSchemaMismatch`,
  imports `MIGRATE_COMMAND_HINT`). They interpolate the constant into sentence
  context; verify the resulting sentences still read correctly after the wording
  change (the surrounding prose says "Migrate … with <hint>, then review with
  `git diff`" — adjust if the new phrasing needs it).
- Docs to edit: `AGENTS.md` line ~90 (and the line ~69 mention of "migrate" if
  it implies a command — it describes the clustering moment, likely fine, but
  verify it does not instruct the removed command); `docs/how-it-works.md`
  line ~53; `docs/internals/schemas.md` line ~39; `docs/internals/architecture.md`
  lines ~122 and ~128.

## Input Dependencies
- Task 2 (the `kk-migrate` skill) defines the skill name and invocation the
  surfaces must point at. The skill should exist (or at least its name be fixed)
  before repointing, so the guidance leads to a real path.

## Output Artifacts
- Updated `src/lib/migrate-guidance.ts`, `src/lib/nodes.ts`,
  `src/commands/init.ts`, `AGENTS.md`, and the three docs pages — every migration
  surface now leads to the working in-session path. This satisfies the second
  half of Primary Success Criterion 2.

## Implementation Notes
The shared constant is the linchpin: changing `MIGRATE_COMMAND_HINT` once
updates both the reader and init together (by design — see its doc comment). Read
the surrounding sentences at each interpolation site so the new wording reads
naturally; do not just swap a noun phrase if the sentence structure assumed a
command.

<details>
<summary>Detailed implementation guidance</summary>

**1. `src/lib/migrate-guidance.ts`.** Rewrite the exported constant to name the
skill. Example direction (final wording at author's discretion, keep it accurate
and skill-centric):
```
export const MIGRATE_COMMAND_HINT =
  'the `/kk-migrate` skill in your agent session (migration now requires an interactive session)';
```
Update the doc comment: it currently explains why `--harness` precedes the
`migrate` subcommand — that rationale is dead. Replace it with a note that the
guidance now points at the in-host skill, still shared by the reader and init so
the two surfaces never drift. Keep the export name `MIGRATE_COMMAND_HINT` (its
two importers reference it) unless you also update both importers in the same
task — renaming is optional and not required.

**2. `src/lib/nodes.ts` `OldLayoutError`** (lines ~68-78). The message reads
"… Migrate the knowledge base with ${MIGRATE_COMMAND_HINT}, then review the
result with `git diff`." With the new constant this becomes "… Migrate the
knowledge base with the `/kk-migrate` skill in your agent session …, then review
… `git diff`." Confirm it reads correctly; tweak the connective words if needed.

**3. `src/commands/init.ts` `reportSchemaMismatch`** (lines ~159-167). The
sentence ends "… will fail until you migrate it: run ${MIGRATE_COMMAND_HINT}."
After the change it should read "… run the `/kk-migrate` skill in your agent
session." Verify the "run <hint>" phrasing still fits; adjust to "use <hint>" if
the new constant already contains a verb.

**4. `AGENTS.md` line ~90.** Current: "… pointing the user to run `npx kenkeep
--harness <id> migrate` …". Rewrite to: the reader rejects the old shape and
points the user to run the `kk-migrate` skill in their agent session; migration
now requires an interactive session (no headless/unattended full migration);
it still preserves every id and edge and is reviewed via `git diff`. Keep the
existing "re-running `init` would not migrate" note. The line ~69 bullet that
calls the v1->v2 clustering "migrate" describes the *moment*, not a command — it
is fine to keep "migrate" as the name of that clustering step, but do not let it
read as a CLI instruction.

**5. Docs.**
- `docs/how-it-works.md` ~line 53: the clause "written only when the LLM clusters
  folders (during migrate or rebalance) or by hand" describes the authoring
  moment and stays valid; only change it if it implies a `migrate` command.
- `docs/internals/schemas.md` ~line 39: "… the reader rejects the old flat
  layout / `schema_version: 1` and points to `npx kenkeep --harness <id>
  migrate`." Replace the command with "points to the `kk-migrate` skill."
- `docs/internals/architecture.md` ~line 122 and ~line 128: replace both
  `npx kenkeep --harness <id> migrate` mentions with the `kk-migrate` skill, and
  at line ~128 note the removal of the headless migration command (the
  deterministic primitive + in-host skill replace it). Keep the substantive
  description of the summary-authoring/carrying/rendering model.

**6. Verify.** `grep -rn "npx kenkeep --harness <id> migrate" src/ docs/
AGENTS.md` must return nothing. Run `tsc --noEmit`, `eslint .`, `prettier
--check .`. The init test that asserts the old hint is updated in Task 5, not
here — but be aware that changing the constant will make that test fail until
Task 5 runs; that is expected and sequenced.
</details>
