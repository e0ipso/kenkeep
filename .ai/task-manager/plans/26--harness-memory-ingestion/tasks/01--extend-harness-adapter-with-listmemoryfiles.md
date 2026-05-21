---
id: 1
group: "adapter-contract"
dependencies: []
status: "pending"
created: 2026-05-21
skills:
  - typescript
---
# Extend HarnessAdapter contract and implement `listMemoryFiles()` in all three adapters

## Objective
Add a required `listMemoryFiles()` method to the `HarnessAdapter` interface in `src/harnesses/types.ts` and implement it in the Claude, Codex, and OpenCode adapters. Claude performs real discovery via a headless child; Codex and OpenCode return `[]` until their hosts ship a memory feature. After this task `npm run typecheck` must pass with the new method required everywhere.

## Skills Required
- typescript (interface design, Zod validation, ESM modules)

## Acceptance Criteria
- [ ] `HarnessAdapter` in `src/harnesses/types.ts` declares `listMemoryFiles(opts?: { timeoutMs?: number }): Promise<string[]>` as a required method.
- [ ] Claude adapter implementation issues the verbatim discovery prompt to a `claude -p` headless child via the existing `runHeadlessClaude` (or equivalent) helper, with `KB_BUILDER_INTERNAL=1` set on the child.
- [ ] Claude adapter validates the response with a Zod schema (`z.array(z.string())`), filters to entries matching `^file://`, de-duplicates, and returns absolute-IRI strings. Malformed/non-JSON responses log a structured warning via `src/lib/log.ts` and return `[]`.
- [ ] Codex and OpenCode adapters export an async `listMemoryFiles()` that returns `[]` (a one-line implementation is acceptable). No headless child is spawned in the empty case.
- [ ] The verbatim discovery prompt is declared as an exported string constant (e.g. `HARNESS_MEMORY_DISCOVERY_PROMPT`) in `src/lib/memory-files.ts` (created in task 2) — OR temporarily in `src/harnesses/types.ts` if task 2 has not landed yet. Adapters import it; no adapter inlines the prompt body.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes, including `lint:detect-harness`.

## Technical Requirements
- ESM TypeScript, Node 22+.
- Reuse the existing per-adapter headless spawn pattern (`src/harnesses/claude/headless.ts` for Claude). Do not introduce a second child-spawn pathway.
- The Zod schema lives next to the method that uses it (Claude adapter) until task 2 centralises it; ad-hoc inline schemas are fine here.
- The prompt body is the verbatim text from GitHub issue #37 (paste exactly; treat as canonical source text).

## Input Dependencies
None.

## Output Artifacts
- Updated `src/harnesses/types.ts`.
- New/updated `src/harnesses/claude/index.ts` (and possibly `claude/headless.ts`) with the discovery call.
- Updated `src/harnesses/codex/index.ts` and `src/harnesses/opencode/index.ts` with `[]` stubs.
- Exported `HARNESS_MEMORY_DISCOVERY_PROMPT` constant (location finalised by task 2).

## Implementation Notes

<details>
<summary>Concrete edit map</summary>

1. **`src/harnesses/types.ts`** — extend the `HarnessAdapter` interface. Example:
   ```ts
   export interface HarnessAdapter {
     // ...existing members...
     /**
      * Ask the host harness for its auto-memory files. Returns absolute `file://` IRIs.
      * Adapters whose host has no memory feature return [].
      */
     listMemoryFiles(opts?: { timeoutMs?: number }): Promise<string[]>;
   }
   ```

2. **Verbatim discovery prompt** — copy the exact prompt text from issue #37 (the JSON-array-of-IRIs prompt described in the issue body). Place it as:
   ```ts
   export const HARNESS_MEMORY_DISCOVERY_PROMPT = `<verbatim text from issue #37>`;
   ```
   Put this in `src/lib/memory-files.ts` when task 2 creates that file; until then it may live in `src/harnesses/types.ts` and be re-exported. Either way, the final state after task 2 is that adapters import it from `src/lib/memory-files.ts`.

3. **Claude adapter** (`src/harnesses/claude/index.ts` + `headless.ts`):
   - Add a `listMemoryFiles({ timeoutMs } = {})` method.
   - Spawn `claude -p` via the existing `runHeadlessClaude` (or analogous helper). Verify `KB_BUILDER_INTERNAL=1` is set on the child env — it already is for the existing helper; do not bypass.
   - Send `HARNESS_MEMORY_DISCOVERY_PROMPT` as the user message.
   - Parse the child's stdout JSON. Validate with `z.array(z.string())`. Filter to entries matching `/^file:\/\//`. De-duplicate.
   - On `JSON.parse` failure, schema failure, or child error: call `log.warn(...)` from `src/lib/log.ts` with `{ adapter: 'claude', kind: 'memory-discovery', err }`, and return `[]`.
   - Honour `timeoutMs` if supplied; otherwise use whatever default the existing headless helper uses.

4. **Codex adapter** (`src/harnesses/codex/index.ts`):
   ```ts
   async listMemoryFiles(): Promise<string[]> {
     return [];
   }
   ```
   No spawn. Add a one-line code comment only if needed to explain "host has no memory feature yet"; otherwise omit per the no-noise comment policy.

5. **OpenCode adapter** (`src/harnesses/opencode/index.ts`): same `[]` stub as codex.

6. Run `npm run typecheck` and `npm run lint` and fix any drift errors. The `lint:detect-harness` rule may flag missing branches if it enumerates adapter methods — update its expected set if so.

7. **Do not add tests in this task** — adapter tests live in task 6. The implementations must still be exercisable.
</details>
