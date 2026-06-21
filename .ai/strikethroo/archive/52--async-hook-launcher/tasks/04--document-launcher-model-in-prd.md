---
id: 4
group: "async-hook-launcher"
dependencies: [3]
status: "completed"
created: 2026-06-18
skills:
  - technical-writing
---
# Document the launcher model, synchrony classification, and stale-lock interaction

## Objective
Make the canonical launcher the documented, authoritative cross-harness solution
and prevent its misuse (e.g. routing context-producing hooks through it). Update
the PRD and related AI-facing docs to cover the hook synchrony classification,
the per-harness async-strategy map, the launcher's guarantees and non-guarantees,
worker logging/diagnostics channels, and the 60s stale-lock interaction.

## Skills Required
- `technical-writing` — author precise PRD and AI-facing documentation that
  matches the implemented mechanism and wiring.

## Acceptance Criteria
- [ ] The PRD (located under `docs/`) documents all five elements:
      1. **Synchrony classification** — every hook labeled either synchronous
         context-producer (`kk-capture`, `kk-session-start`) or asynchronous
         advisory worker (`kk-proposal-drain`, `kk-lint-tick`).
      2. **Per-harness async-strategy map** — native async (Claude), plugin async
         (OpenCode), launcher (Codex, Cursor, Copilot).
      3. **Launcher guarantees** (frees the host slot immediately; survives host
         timeout kills via process-group isolation; single named entry point)
         and **non-guarantees** (no user-visible output; no retry; no
         ordering/at-most-once delivery beyond what the lock provides).
      4. **Worker logging/diagnostics channels** — `hook-errors-YYYY-MM-DD.log`
         and `proposal/<session>.jsonl`.
      5. **Stale-lock interaction** — a host-killed detached worker leaves a lock
         that the next run reclaims via the 60s stale-lock recovery
         (commits c073666 / a361989).
- [ ] AI-facing docs (e.g. `AGENTS.md` and related hook docs) that referenced the
      detach mechanism or drain-specific naming are updated to describe the
      canonical launcher.
- [ ] Code-level doc comments in the launcher files describe it generically, with
      no drain-specific leakage (verify against Task 2's output).
- [ ] Documentation reflects the actual implemented mechanism and per-harness
      wiring from Tasks 2–3 (no aspirational or contradictory claims).

## Technical Requirements
- Locate the PRD under `docs/`; update it in place.
- Cross-check every documented claim against the implemented launcher (Task 2)
  and per-harness wiring (Task 3) so the docs are accurate, not aspirational.

## Input Dependencies
- Task 2: launcher guarantees, contract, and generic naming.
- Task 3: the concrete per-harness async-strategy map.

## Output Artifacts
- Updated PRD under `docs/` covering the five required elements.
- Updated `AGENTS.md` and related AI-facing hook docs referencing the canonical
  launcher.

## Implementation Notes
This is a documentation task; it has no test deliverable. Its correctness comes
from fidelity to the shipped code — write it after Tasks 2 and 3 so the
synchrony classification, per-harness map, guarantees, and naming all match what
was actually built. Emphasize the misuse guard: context-producing hooks
(`kk-capture`, `kk-session-start`) must stay synchronous and must NOT be routed
through the launcher.

<details>
<summary>Detailed implementation guidance</summary>

1. Find the PRD: search `docs/` for the kenkeep PRD / hook architecture
   document. Add or update a section covering the five elements listed in the
   acceptance criteria, in that order.
2. For the synchrony classification, present a table: hook name, classification
   (synchronous context-producer vs. asynchronous advisory worker), and why
   (context-producers return `additionalContext` or must finish I/O before the
   session proceeds).
3. For the per-harness map, present a table: harness → async mechanism (Claude
   native `async: true`; OpenCode plugin async; Codex/Cursor/Copilot launcher).
   Mirror exactly what Task 3 wired.
4. State launcher guarantees and non-guarantees as explicit bullet lists. Note
   that on harnesses where the config writer drops the `async` flag, the launcher
   — not the flag — is what guarantees non-blocking behavior.
5. Document the diagnostics channels (`hook-errors-YYYY-MM-DD.log`,
   `proposal/<session>.jsonl`) and the stale-lock interaction: a killed detached
   worker leaves a lock reclaimed by the next run within the 60s stale threshold
   (reference commits c073666 / a361989).
6. Update `AGENTS.md` and any other AI-facing docs that mention the old detach
   mechanism or `KENKEEP_DRAIN_DETACHED`; replace with the launcher description.
7. Verify the launcher source files' doc comments are generic (sanity-check
   Task 2's rename landed in comments too).

</details>
