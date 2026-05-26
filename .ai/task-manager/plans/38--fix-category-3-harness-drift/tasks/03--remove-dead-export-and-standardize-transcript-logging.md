---
id: 3
group: "cleanup-and-consistency"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript
---
# Remove Dead Export and Standardize Transcript Logging

## Objective
Remove the unused `refreshCodexTemplates` export from Codex's `install.ts`, and add `console.warn` logging to silent transcript parse error catch blocks in Claude and OpenCode adapters.

## Skills Required
- TypeScript: removing dead code and adding logging to catch blocks in harness adapter files

## Acceptance Criteria
- [ ] `refreshCodexTemplates` function is removed from `src/harnesses/codex/install.ts`
- [ ] `grep -rn 'refreshCodexTemplates' src/` returns zero matches (not imported or referenced anywhere)
- [ ] `src/harnesses/claude/transcript.ts` logs `console.warn` with a descriptive message when a JSONL line fails to parse (around line 45-46)
- [ ] `src/harnesses/opencode/transcript.ts` logs `console.warn` in all silent catch blocks where JSON parse failures are swallowed (lines 79, 98-99, 117-118)
- [ ] All existing tests pass (`npx vitest run`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Verify `refreshCodexTemplates` has no callers before removing: `grep -rn 'refreshCodexTemplates' src/ --include='*.ts'`
- Warning format should match the existing Codex/Cursor pattern: `console.warn(\`parse<Harness>Transcript: skipping malformed JSONL line: ${(err as Error).message}\`)`

## Input Dependencies
None — these are independent fixes.

## Output Artifacts
- Modified `src/harnesses/codex/install.ts` (dead export removed)
- Modified `src/harnesses/claude/transcript.ts` (console.warn added)
- Modified `src/harnesses/opencode/transcript.ts` (console.warn added)

## Implementation Notes
<details>

**Part A — Remove dead `refreshCodexTemplates` export**

1. First verify no callers exist:
   ```bash
   grep -rn 'refreshCodexTemplates' src/ --include='*.ts'
   ```
   Expected: only the definition in `src/harnesses/codex/install.ts` lines 59-64.

2. Remove the entire function (lines 59-64) and its JSDoc comment (lines 54-58) from `src/harnesses/codex/install.ts`.

**Part B — Add `console.warn` to Claude transcript parser**

In `src/harnesses/claude/transcript.ts`, the catch block at lines 45-46 is:
```typescript
    } catch {
      continue;
    }
```

Change to:
```typescript
    } catch (err) {
      console.warn(`parseClaudeTranscript: skipping malformed JSONL line: ${(err as Error).message}`);
      continue;
    }
```

**Part C — Add `console.warn` to OpenCode transcript parser**

In `src/harnesses/opencode/transcript.ts`, there are three silent catch blocks:

1. Session file parse (line 79): `catch { sessionFile = null; }` — change to log and set null.
2. Message file parse (lines 98-99): `catch { content = {}; }` — change to log and set empty.
3. Part file parse (lines 117-118): `catch { content = {}; }` — change to log and set empty.

For each, add a `console.warn` with a descriptive prefix, e.g.:
```typescript
} catch (err) {
  console.warn(`parseOpenCodeTranscript: skipping malformed JSON file: ${(err as Error).message}`);
  content = {};
}
```

**Verification**: Run `npx vitest run`. Run `grep -rn 'refreshCodexTemplates' src/` (should return zero). Read the modified transcript files to verify `console.warn` is present in catch blocks.

</details>
