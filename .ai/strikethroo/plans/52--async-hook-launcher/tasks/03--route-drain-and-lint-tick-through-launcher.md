---
id: 3
group: "async-hook-launcher"
dependencies: [2]
status: "completed"
created: 2026-06-18
skills:
  - typescript
complexity_score: 6
complexity_notes: "Touches five harness adapters with divergent async semantics; must keep Claude/OpenCode unchanged while routing two hooks through the launcher on three adapters and handling the writer that drops the async flag."
---
# Route proposal drain and lint tick through the canonical launcher per harness

## Objective
Make both long-running, non-context hooks (proposal drain and lint tick) consume
the canonical launcher consistently, matching each harness's capability: Claude
keeps native `async: true` (drain remains a no-op there by existing design),
OpenCode keeps plugin async dispatch, and Codex, Cursor, and Copilot route both
hooks through the launcher. The runtime launcher — not a host async flag — must
be what guarantees non-blocking behavior on the detach-reliant harnesses.

## Skills Required
- `typescript` — update per-harness hook specs, config writers, and the
  `kk-proposal-drain` / `kk-lint-tick` hook sources to use the launcher.

## Acceptance Criteria
- [ ] `kk-proposal-drain` and `kk-lint-tick` both route through the launcher on
      Codex, Cursor, and Copilot.
- [ ] Claude continues to rely on native `async: true` (drain still a no-op
      there); OpenCode continues plugin async dispatch — neither mechanism is
      changed.
- [ ] Where a config writer drops the `async` flag (e.g. `writeCodexHooks`), the
      launcher remains the load-bearing guarantee; the generated config still
      contains the drain and lint-tick entries and relies on the launcher rather
      than the dropped flag.
- [ ] Lint-tick changes are limited to routing it through the launcher — lint
      cadence, state (`src/lib/lint-state.ts`), and behavior are unchanged.
- [ ] The full test suite passes; the Task 1 held-open-stdin invariant holds for
      all three detach-reliant harnesses after wiring.

## Technical Requirements
- Files: `src/harnesses/{claude,codex,cursor,copilot,opencode}/hook-spec.ts`,
  `hooks-config.ts`, `hooks/kk-proposal-drain.ts`, `hooks/kk-lint-tick.ts`, and
  `src/harnesses/types.ts` (`HookSpec`) if the async declaration needs adjusting.
- Note the asymmetry: the Codex spec may mark drain `async: true` but
  `writeCodexHooks` (`src/harnesses/codex/hooks-config.ts`) drops it and writes a
  30s `timeout`; correctness on Codex/Cursor/Copilot must come from the launcher,
  not the flag.
- Do not alter Claude's drain-as-no-op design or add native async to harnesses
  that lack it (out of scope).

## Input Dependencies
- Task 2: the canonical named launcher and its payload/marker contract.

## Output Artifacts
- Per-harness wiring so both long-running hooks use the launcher uniformly on the
  detach-reliant harnesses, leaving Claude and OpenCode mechanisms intact.
- The concrete per-harness async-strategy map that Task 4 documents.

## Implementation Notes
Guard against scope creep: lint-tick is migrated only by routing it through the
launcher on harnesses that need it. Do not change its cadence or state. Guard
against re-narrowing to Codex: apply the wiring uniformly to Codex, Cursor, and
Copilot.

<details>
<summary>Detailed implementation guidance</summary>

1. For each of Codex, Cursor, Copilot:
   - In `hooks/kk-proposal-drain.ts` and `hooks/kk-lint-tick.ts`, invoke the
     launcher from Task 2 instead of the old drain-specific `detach: true`
     arrangement.
   - In `hook-spec.ts` / `hooks-config.ts`, ensure both hooks are declared and
     the generated host config lists them. Verify that even when the writer drops
     `async` (Codex), the launcher still runs detached.
2. For Claude: confirm drain stays a no-op and native `async: true` is untouched.
   Lint-tick on Claude uses native async — do not route it through the launcher
   if the host provides async natively; only use the launcher where native async
   is absent.
3. For OpenCode: confirm plugin async dispatch is unchanged; do not route through
   the launcher if the plugin already dispatches asynchronously.
4. Re-run the Task 1 / Task 2 tests to confirm the invariant holds across Codex,
   Cursor, and Copilot after wiring, and that lint-tick behavior is unchanged.
5. Build the hooks and sanity-check generated configs (`.codex/hooks.json`,
   `.cursor/hooks.json`, `.github/hooks/kk.json`) contain both entries.

</details>
