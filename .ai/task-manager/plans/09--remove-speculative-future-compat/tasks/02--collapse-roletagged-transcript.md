---
id: 2
group: "dead-fields"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Collapse RoleTaggedTranscript to interleaved-only

## Objective
Remove the dead `user: string[]` and `agent: string[]` fields from `RoleTaggedTranscript`. Stop populating them in `parseTranscriptJsonl`. Update the transcript test to assert only `interleaved`.

## Skills Required
- `typescript`: shrink an interface, remove dead writes in a parser, adjust tests.

## Acceptance Criteria
- [ ] `RoleTaggedTranscript` in `src/lib/transcript.ts` declares only `interleaved: Array<{ role: 'user' | 'agent'; text: string }>`.
- [ ] `parseTranscriptJsonl` pushes only to `out.interleaved`. The local `out` initializer no longer has `user` or `agent` keys.
- [ ] `renderRoleTagged` continues to work unchanged (it already uses only `interleaved`).
- [ ] `tests/lib/transcript.test.ts` no longer asserts `parsed.user` or `parsed.agent`. The remaining assertions cover that `interleaved` is built correctly across the same scenarios (mixed user/assistant, tool-use block filtering, malformed-line skipping, role rendering).
- [ ] `grep -rn "RoleTaggedTranscript" src/ tests/` returns hits only inside `src/lib/transcript.ts` and `tests/lib/transcript.test.ts`.
- [ ] `grep -rn "parsed\\.user\|parsed\\.agent\|out\\.user\|out\\.agent" src/ tests/` returns no hits.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The `extractText` call only needs to run once per branch (user or assistant); the previous duplicate call due to writing to two arrays disappears.
- No external module imports `RoleTaggedTranscript.user` or `RoleTaggedTranscript.agent` (verified via grep against `src/`).

## Input Dependencies
None.

## Output Artifacts
- Updated `src/lib/transcript.ts` with a shrunk interface and trimmed parser.
- Updated `tests/lib/transcript.test.ts` with assertions targeting only `interleaved`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Update `src/lib/transcript.ts`**:
   - Replace the interface declaration with:
     ```ts
     export interface RoleTaggedTranscript {
       interleaved: Array<{ role: 'user' | 'agent'; text: string }>;
     }
     ```
   - In `parseTranscriptJsonl`, change `const out: RoleTaggedTranscript = { user: [], agent: [], interleaved: [] };` to `const out: RoleTaggedTranscript = { interleaved: [] };`.
   - In the `role === 'user'` branch, remove the `out.user.push(text);` line. Keep `out.interleaved.push({ role: 'user', text });`.
   - In the `role === 'assistant' || role === 'agent'` branch, remove the `out.agent.push(text);` line. Keep `out.interleaved.push({ role: 'agent', text });`.

2. **Update `tests/lib/transcript.test.ts`**:
   - Replace assertions like `expect(parsed.user).toEqual(['Hello', 'Use bravo_pii cache.'])` and `expect(parsed.agent).toEqual(['Hi there'])` with equivalent assertions against `parsed.interleaved`. For example:
     ```ts
     expect(parsed.interleaved.map(s => s.text)).toEqual(['Hello', 'Hi there', 'Use bravo_pii cache.']);
     expect(parsed.interleaved.map(s => s.role)).toEqual(['user', 'agent', 'user']);
     ```
   - In the "ignores tool_use and system blocks" test, replace the `parsed.agent` and `parsed.user` assertions with `expect(parsed.interleaved).toEqual([{ role: 'agent', text: 'Reading file...' }]);`.
   - In the "skips malformed JSON lines silently" test, replace `expect(parsed.user).toEqual(['ok'])` with `expect(parsed.interleaved).toEqual([{ role: 'user', text: 'ok' }])`.
   - In the "renders role-tagged transcript" test, the literal `t` object passed to `renderRoleTagged` must drop the `user` and `agent` keys so it matches the shrunk interface; keep only `interleaved`.

3. **Verify**:
   - `rg -n "RoleTaggedTranscript" src/ tests/` shows only the file and its test.
   - `rg -n "parsed\\.user|parsed\\.agent|out\\.user|out\\.agent" src/ tests/` returns no hits.
   - `npx tsc --noEmit` exits 0.
   - `npm test` exits 0.

</details>
