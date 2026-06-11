---
id: 1
group: "captured-by-trigger"
dependencies: []
status: "completed"
created: 2026-06-11
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "Touches the shared capture entry point plus all five adapter hooks; behavior-preserving for Claude, behavior-correcting for the rest. Single coherent refactor, so kept as one task with its mapping unit test."
---
# Adapter-Owned `captured_by` Trigger Mapping

## Objective
Relocate `CaptureTrigger` derivation out of the shared, Claude-keyed
`HOOK_EVENT_TO_TRIGGER` map and into each harness adapter, so every harness
records the real lifecycle event in `captured_by` instead of contorting native
events into Claude's vocabulary (or defaulting to `stop`). Claude's existing
values are unchanged; no shared code remains keyed on Claude event names.

## Skills Required
- **typescript** — refactor the capture entry point and the five adapter hooks.
- **vitest** — add a unit test asserting each adapter's native→canonical mapping.

## Acceptance Criteria
- [ ] `src/lib/capture.ts` no longer contains `HOOK_EVENT_TO_TRIGGER` or an
      `eventToTrigger` that recognizes only `Stop`/`SessionEnd`/`PreCompact`;
      `captureSession` consumes an already-canonical `CaptureTrigger`.
- [ ] Each adapter maps its **native** lifecycle events to the canonical trigger:
      Claude `Stop`→`stop`, `SessionEnd`→`session_end`, `PreCompact`→`pre_compact`;
      Cursor `stop`→`stop`, `sessionEnd`→`session_end`, `preCompact`→`pre_compact`;
      Codex `Stop`→`stop`; OpenCode `session.idle`→`stop`; Copilot
      `agentStop`→`stop`, `sessionEnd`→`session_end`.
- [ ] The `CURSOR_EVENT_TO_HOOK` map, the Codex/OpenCode hard-coded `'Stop'`, and
      the Copilot inline `event === 'agentStop' ? 'Stop' : 'SessionEnd'` ternary
      are all removed in favor of a per-adapter native→canonical mapping.
- [ ] The canonical enum (`stop`/`session_end`/`pre_compact`/`manual`) in
      `src/lib/schemas.ts` is **unchanged**; existing session logs stay valid.
- [ ] A vitest unit test asserts each adapter's mapping, including: Copilot
      `sessionEnd`→`session_end` and `agentStop`→`stop`; Cursor `preCompact`→
      `pre_compact`; Codex `Stop`→`stop`; Claude `SessionEnd`→`session_end`.
- [ ] `npm test` (or `npx vitest run`) and the type/lint build pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript / Node 22+, ESM. Files in play (verified against the current tree):
  - `src/lib/capture.ts:41-58` — `HOOK_EVENT_TO_TRIGGER`, `eventToTrigger`,
    `HookInput`, and `captureSession` (currently calls
    `eventToTrigger(input.hook_event_name)`).
  - `src/lib/schemas.ts:11` — `CaptureTriggerSchema` (canonical enum; do **not**
    change it).
  - `src/harnesses/claude/hooks/kk-capture.ts:54-55` — passes
    `hook_event_name` straight through.
  - `src/harnesses/cursor/hooks/kk-capture.ts:21-25,70-73` —
    `CURSOR_EVENT_TO_HOOK`.
  - `src/harnesses/codex/hooks/kk-capture.ts:61` — hard-coded `'Stop'`.
  - `src/harnesses/opencode/hooks/kk-capture.ts:72` — hard-coded `'Stop'`.
  - `src/harnesses/copilot/hooks/kk-capture.ts:70-71` — inline
    `agentStop ? 'Stop' : 'SessionEnd'` translation.
- The hooks are compiled to `dist/hooks/<harness>/kk-capture.cjs` (tsup) and the
  integration test in `tests/hooks/kk-capture.test.ts` drives those compiled
  artifacts via stdin — keep that black-box contract working.

## Input Dependencies
None. This is the first task and depends on no other task's output.

## Output Artifacts
- A refactored shared capture entry point that accepts a canonical
  `CaptureTrigger`.
- Per-adapter native→canonical trigger mappings (exported so they are unit
  testable).
- A vitest unit test pinning every adapter's mapping.

## Implementation Notes

> **Plan snapshot correction (verified against the live tree):** the plan's
> Background says Copilot "passes its native event through ... and default[s] to
> `stop`." That is **stale** — `copilot/hooks/kk-capture.ts:70-71` already
> translates inline to Claude names (`agentStop ? 'Stop' : 'SessionEnd'`). The
> refactor below still applies: replace that translation with a native→canonical
> map. The architectural goal (no shared code keyed on Claude event names) is
> unchanged.

> **Test philosophy — "write a few tests, mostly integration."** Meaningful tests
> verify custom business logic, critical paths, and edge cases specific to this
> application. Test *your* code, not the framework. WRITE tests for: custom
> business logic and algorithms; critical workflows and data transformations;
> edge cases and error conditions for core functionality; integration points;
> complex validation/calculations. DO NOT write tests for: third-party library
> functionality; framework features; simple CRUD without custom logic; trivial
> getters/setters or static config; obvious functionality that would break
> immediately if wrong. Combine related scenarios into a single task; favor
> integration and critical-path coverage over per-method unit tests. The
> per-adapter trigger mapping IS custom business logic — one focused unit test
> covering all adapters is the right amount; do not add per-event test files.

<details>
<summary>Executable guidance</summary>

**1. Pick the canonical-trigger seam.** Two clean options; prefer (a):

(a) Make `HookInput` carry the canonical trigger directly. In
`src/lib/capture.ts`:
- Delete `HOOK_EVENT_TO_TRIGGER` and `eventToTrigger`.
- Replace `hook_event_name?: string` on `HookInput` with
  `trigger?: CaptureTrigger` (import the type — it is already imported).
- In `captureSession`, replace `const trigger = eventToTrigger(input.hook_event_name);`
  with `const trigger = input.trigger ?? 'stop';`.

(b) Alternatively keep `HookInput.hook_event_name` but move the map; this is
worse because the field name still implies Claude vocabulary. Use (a).

**2. Give each adapter its own native→canonical map.** In each adapter create a
small exported record and resolve the trigger before building `HookInput`. The
stdin event name each adapter reads is its own native vocabulary:

- `src/harnesses/claude/hooks/kk-capture.ts` — native events are Claude names:
  ```ts
  export const CLAUDE_EVENT_TO_TRIGGER = {
    Stop: 'stop', SessionEnd: 'session_end', PreCompact: 'pre_compact',
  } as const satisfies Record<string, CaptureTrigger>;
  ```
  Resolve `CLAUDE_EVENT_TO_TRIGGER[name] ?? 'stop'` and pass `trigger` on `HookInput`.
- `src/harnesses/cursor/hooks/kk-capture.ts` — replace `CURSOR_EVENT_TO_HOOK`
  with `CURSOR_EVENT_TO_TRIGGER = { stop:'stop', sessionEnd:'session_end', preCompact:'pre_compact' }`.
- `src/harnesses/codex/hooks/kk-capture.ts` — Codex emits only Stop; pass
  `trigger: 'stop'` (drop `hook_event_name: 'Stop'`). A one-entry map or a
  literal is fine — keep it explicit and exported for the test.
- `src/harnesses/opencode/hooks/kk-capture.ts` — OpenCode's lifecycle event is
  `session.idle`; map it to `'stop'`. Replace `hook_event_name: 'Stop'`.
- `src/harnesses/copilot/hooks/kk-capture.ts` — replace lines 70-71 with
  `COPILOT_EVENT_TO_TRIGGER = { agentStop:'stop', sessionEnd:'session_end' }`,
  resolving from the stdin event (`pickString(payload,'hook_event_name','event','type')`),
  defaulting to `'stop'`.

**3. Sweep for stragglers.** `grep -rn "eventToTrigger\|HOOK_EVENT_TO_TRIGGER\|hook_event_name" src/` and fix every usage. The Claude hook reads
`payload['hook_event_name']` from *stdin* (its native event) — that read stays;
only the value passed into `captureSession` changes from a raw string to a
canonical trigger.

**4. Unit test (new file, e.g. `tests/harnesses/captured-by-trigger.test.ts`).**
Import each adapter's exported `*_EVENT_TO_TRIGGER` map (or a small exported
`resolveTrigger(event)` helper if you add one) and assert the full table with
`it.each`. Cover at minimum the five rows in the Acceptance Criteria plus the
unknown-event→`stop` default. Do **not** add fixtures here — this is pure
mapping logic.

**5. Do not touch the Copilot transcript parser or its fixtures** — that is
Task 2's surface. This task only changes which `CaptureTrigger` is recorded, not
how transcripts are parsed. The existing copilot integration assertion in
`tests/hooks/kk-capture.test.ts` (`captured_by: session_end` for a `sessionEnd`
stdin event) must keep passing unchanged.
</details>
