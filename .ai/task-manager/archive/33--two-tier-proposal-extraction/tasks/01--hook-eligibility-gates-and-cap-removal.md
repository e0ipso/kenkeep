---
id: 1
group: "hook-eligibility"
dependencies: []
status: "completed"
created: "2026-05-24"
skills: ["typescript"]
---
# Add hook eligibility gates and remove entry cap

## Objective
Prevent proposal-drain hooks from firing when they can't succeed (Claude harness, missing CLI binary), and remove the 5-entry cap so eligible hooks drain the full queue.

## Skills Required
TypeScript — all changes are small edits to existing `.ts` files.

## Acceptance Criteria
- [ ] Claude hook (`src/harnesses/claude/hooks/kb-proposal-drain.ts`) returns early after the recursion guard with a stderr message, before calling `drainProposalQueue`
- [ ] Cursor hook (`src/harnesses/cursor/hooks/kb-proposal-drain.ts`) checks `which agent` after the recursion guard; returns early with stderr message if not found
- [ ] Codex hook (`src/harnesses/codex/hooks/kb-proposal-drain.ts`) checks `which codex` after the recursion guard; returns early with stderr message if not found
- [ ] OpenCode hook (`src/harnesses/opencode/hooks/kb-proposal-drain.ts`) checks `which opencode` after the recursion guard; returns early with stderr message if not found
- [ ] `DEFAULT_MAX_ENTRIES` in `src/lib/proposal-drain.ts` is changed from `5` to `Infinity`
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use `execFileSync('which', [binary])` wrapped in a try/catch for the CLI probe (fast, no side effects). Import `execFileSync` from `node:child_process`.
- The `which` check goes after the `KB_BUILDER_INTERNAL` recursion guard early return and before any other logic.
- The Claude hook already detects itself — it's always running inside Claude. The early return goes right after line 27 (`if (process.env['KB_BUILDER_INTERNAL'] === '1') return;`).
- For the `DEFAULT_MAX_ENTRIES` change: only change the value on line 11 of `src/lib/proposal-drain.ts` from `5` to `Infinity`. The `maxEntries` parameter and the `for` loop's `if (processed.length >= maxEntries) break;` at line 85 work correctly with `Infinity`.

## Input Dependencies
None — this task has no dependencies.

## Output Artifacts
- Modified `src/harnesses/claude/hooks/kb-proposal-drain.ts`
- Modified `src/harnesses/cursor/hooks/kb-proposal-drain.ts`
- Modified `src/harnesses/codex/hooks/kb-proposal-drain.ts`
- Modified `src/harnesses/opencode/hooks/kb-proposal-drain.ts`
- Modified `src/lib/proposal-drain.ts`

## Implementation Notes

<details>

### Claude hook early return (`src/harnesses/claude/hooks/kb-proposal-drain.ts`)

Insert immediately after line 27 (`if (process.env['KB_BUILDER_INTERNAL'] === '1') return;`):

```typescript
// Tier 1 gate: Claude sessions defer extraction to /kb-curate.
process.stderr.write(`${PACKAGE_TAG} skipping proposal drain — Claude sessions defer extraction to /kb-curate\n`);
return;
```

This causes the function to return before any stdin reading, root finding, or `drainProposalQueue` call. The `PACKAGE_TAG` constant is already defined at line 21 as `'[ai-knowledge-base]'`.

### Non-Claude hooks CLI check

For **each** of cursor, codex, and opencode hooks, insert after the `KB_BUILDER_INTERNAL` guard (line 18 for cursor, line 20 for codex and opencode). The pattern is the same for all three, differing only in the binary name:

1. Add import at the top of the file: `import { execFileSync } from 'node:child_process';`
2. Insert after the recursion guard:

```typescript
try {
  execFileSync('which', ['<BINARY>'], { stdio: 'ignore' });
} catch {
  process.stderr.write(`${PACKAGE_TAG} <BINARY> not found on PATH; deferring extraction to /kb-curate\n`);
  return;
}
```

Binary names per harness:
- **cursor**: `agent`
- **codex**: `codex`
- **opencode**: `opencode`

### Entry cap removal (`src/lib/proposal-drain.ts`)

Line 11, change:
```typescript
export const DEFAULT_MAX_ENTRIES = 5;
```
to:
```typescript
export const DEFAULT_MAX_ENTRIES = Infinity;
```

No other changes needed in this file — the existing `for` loop at line 85 handles `Infinity` correctly via `if (processed.length >= maxEntries) break;`.

</details>
