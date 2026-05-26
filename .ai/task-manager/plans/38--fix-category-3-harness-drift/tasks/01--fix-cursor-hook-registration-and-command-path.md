---
id: 1
group: "cursor-adapter-fixes"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript
---
# Fix Cursor Hook Registration and Command Path

## Objective
Fix two Cursor adapter bugs: (1) `install.ts` silently drops `async` and `matcher` fields from hook specs during registration, and (2) `hooks-config.ts` generates hook commands without the `./` prefix that Codex uses.

## Skills Required
- TypeScript: modifying object spread patterns and string template literals in harness adapter files

## Acceptance Criteria
- [ ] `src/harnesses/cursor/install.ts` spreads `async` and `matcher` from hook specs, matching the pattern in `src/harnesses/codex/install.ts` lines 48-49
- [ ] `src/harnesses/cursor/hooks-config.ts` line 88 uses `node ./${hook.scriptPath}` instead of `node ${hook.scriptPath}`
- [ ] All existing tests pass (`npx vitest run`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The fix in `install.ts` adds two conditional spread lines to the `cursorHookSpecs.map()` callback (around line 36-39)
- The fix in `hooks-config.ts` adds `./` prefix to the command template string (line 88)

## Input Dependencies
None — these are independent fixes to Cursor adapter files.

## Output Artifacts
- Modified `src/harnesses/cursor/install.ts`
- Modified `src/harnesses/cursor/hooks-config.ts`

## Implementation Notes
<details>

**Bug 1 — Missing `async` and `matcher` spreads in `install.ts`**

In `src/harnesses/cursor/install.ts`, the `cursorHookSpecs.map()` callback at lines 36-39 currently produces:

```typescript
cursorHookSpecs.map(spec => ({
  event: spec.event,
  scriptPath: `.cursor/hooks/${spec.scriptPath}`,
}))
```

It must match the Codex pattern in `src/harnesses/codex/install.ts` lines 45-50:

```typescript
cursorHookSpecs.map(spec => ({
  event: spec.event,
  scriptPath: `.cursor/hooks/${spec.scriptPath}`,
  ...(spec.async ? { async: true } : {}),
  ...(spec.matcher ? { matcher: spec.matcher } : {}),
}))
```

**Bug 3 — Missing `./` prefix in `hooks-config.ts`**

In `src/harnesses/cursor/hooks-config.ts` line 88, change:

```typescript
command: `node ${hook.scriptPath}`,
```

to:

```typescript
command: `node ./${hook.scriptPath}`,
```

This aligns with the Codex adapter's path format.

**Verification**: Run `npx vitest run` to confirm no regressions. Read the modified files to verify the changes are correct.

</details>
