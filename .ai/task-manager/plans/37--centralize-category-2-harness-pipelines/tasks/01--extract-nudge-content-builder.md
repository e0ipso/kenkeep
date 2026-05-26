---
id: 1
group: "pipeline-extraction"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript-modules
---
# Extract session-start nudge content builder into src/lib/session-start.ts

## Objective

Add `buildNudgeContent()` to `src/lib/session-start.ts` that assembles the status line, ASCII box, and code-fence instruction from a `SessionStartResult`. Replace the three identical inline assemblies in `codex/hooks/kb-session-start.ts`, `cursor/hooks/kb-session-start.ts`, and `opencode/hooks/kb-session-start.ts` with a single call to this function. `claude/hooks/kb-session-start.ts` must not be touched.

## Skills Required

- TypeScript ESM module authoring and import management

## Acceptance Criteria

- [ ] `buildNudgeContent(result: SessionStartResult): { statusLine: string; content: string }` is exported from `src/lib/session-start.ts`
- [ ] `grep -n "KB curation overdue" src/harnesses/codex/hooks/kb-session-start.ts` returns zero matches (the inline string is gone)
- [ ] `grep -n "KB curation overdue" src/harnesses/cursor/hooks/kb-session-start.ts` returns zero matches
- [ ] `grep -n "KB curation overdue" src/harnesses/opencode/hooks/kb-session-start.ts` returns zero matches
- [ ] `grep -n "┌──────" src/harnesses/*/hooks/kb-session-start.ts` returns zero matches
- [ ] `src/harnesses/claude/hooks/kb-session-start.ts` is unchanged (verified by `git diff`)
- [ ] `npm run build` succeeds with no new errors
- [ ] `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- New function signature: `export function buildNudgeContent(result: SessionStartResult): { statusLine: string; content: string }`
- `statusLine` is the single-line status (nudged or non-nudged variant)
- `content` is `statusLine + '\n\n' + result.additionalContext` with the nudge box and code-fence instruction appended when `result.nudged` is true
- The box and code-fence instruction text must be byte-for-byte identical to what is currently inline in the three hooks
- The codex hook emits `process.stdout.write(JSON.stringify({ additionalContext: content }))`
- The cursor hook emits `process.stdout.write(JSON.stringify({ additional_context: context }))` — note different key name; only the envelope key differs
- The opencode hook writes to a file at `.opencode/AGENTS.md` — it uses the `content` value prefixed with `AGENTS_HEADER`
- Each of the three hooks calls `buildNudgeContent(result)` and destructures `{ statusLine, content }`, then applies its own envelope

## Input Dependencies

None — this task has no dependencies.

## Output Artifacts

- Modified `src/lib/session-start.ts` with `buildNudgeContent()` added and exported
- Modified `src/harnesses/codex/hooks/kb-session-start.ts`
- Modified `src/harnesses/cursor/hooks/kb-session-start.ts`
- Modified `src/harnesses/opencode/hooks/kb-session-start.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Step 1: Read the three hooks to verify the current inline assembly

Before writing any code, read `src/harnesses/codex/hooks/kb-session-start.ts`, `src/harnesses/cursor/hooks/kb-session-start.ts`, and `src/harnesses/opencode/hooks/kb-session-start.ts` and verify the inline box/code-fence strings are identical. They should be.

### Step 2: Add `buildNudgeContent()` to `src/lib/session-start.ts`

Open `src/lib/session-start.ts`. At the end of the file (after `buildSessionStartContext()`), add:

```typescript
export function buildNudgeContent(result: SessionStartResult): { statusLine: string; content: string } {
  const statusLine = result.nudged
    ? `🚨 KB curation overdue: ${result.pendingSessions} pending, ${result.candidateCount} candidates — run /kb-curate`
    : `📋 KB queue: ${result.pendingSessions} pending session log(s), ${result.candidateCount} candidate(s)`;
  let content = statusLine + '\n\n' + result.additionalContext;
  if (result.nudged) {
    const box =
      '┌──────────────────────────────────────┐\n' +
      '│ 🚨 KB curation is overdue            │\n' +
      '│ Run /kb-curate to process them.      │\n' +
      '└──────────────────────────────────────┘\n' +
      `${result.pendingSessions} pending session(s), ${result.candidateCount} candidate(s)`;
    content +=
      '\n> IMPORTANT: After completing your response, append the following block ' +
      'verbatim inside a code fence as an addendum at the very end:\n>\n> ```\n> ' +
      box.split('\n').join('\n> ') +
      '\n> ```\n';
  }
  return { statusLine, content };
}
```

**Critical**: copy the exact string literals from the live source files rather than trusting this snippet, in case they have diverged.

### Step 3: Update the codex hook

In `src/harnesses/codex/hooks/kb-session-start.ts`:
1. Add `buildNudgeContent` to the import from `../../../lib/session-start.js`.
2. Replace the entire `statusLine`/`content`/`box` block with:
   ```typescript
   const { statusLine, content } = buildNudgeContent(result);
   ```
3. The `process.stdout.write(JSON.stringify({ additionalContext: content }))` line is unchanged.
4. The two `process.stderr.write(...)` lines that use `statusLine` remain unchanged.

### Step 4: Update the cursor hook

Same as codex but the stdout key is `additional_context`:
```typescript
const { statusLine, content: context } = buildNudgeContent(result);
```
Then `process.stdout.write(JSON.stringify({ additional_context: context }))` is unchanged.

### Step 5: Update the opencode hook

In `src/harnesses/opencode/hooks/kb-session-start.ts`:
1. Add `buildNudgeContent` to the import.
2. Replace the inline assembly:
   ```typescript
   const { statusLine, content } = buildNudgeContent(result);
   ```
3. The `writeFileSync(target, ...)` call uses `content` — it now gets the value from `buildNudgeContent`.

### Step 6: Verify claude is untouched

Run `git diff src/harnesses/claude/hooks/kb-session-start.ts` — expect no output.

### Step 7: Build and test

```
npm run build
npm test
```

</details>
