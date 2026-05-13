---
id: 4
group: "library-swaps"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Replace src/lib/log.ts with picocolors

## Objective
Replace the hand-rolled ANSI logger in `src/lib/log.ts` with `picocolors`, fixing the `NO_COLOR` spec violation (the current code disables colour only when the value is exactly `'1'`; per spec, any non-empty value should disable colour) while preserving the existing `log.info/warn/error/success/plain` API and `•/!/✗/✓` glyphs.

## Skills Required
- `typescript`: small library swap; add a runtime dependency and rewrite one file.

## Acceptance Criteria
- [ ] `picocolors` is added to `dependencies` in `package.json`.
- [ ] `src/lib/log.ts` imports `pc` from `picocolors` and uses `pc.cyan/yellow/red/green` for the level prefixes; the hand-rolled `useColor` flag, ANSI escape constants, and `paint()` function are gone.
- [ ] Exported API is identical: `export const log = { info, warn, error, success, plain }` with the same signatures and the same glyphs (`•` info, `!` warn, `✗` error, `✓` success).
- [ ] `log.error` and `log.warn` still write to `console.error`; the other three still write to `console.log`.
- [ ] Setting `NO_COLOR` to any non-empty value (`'1'`, `'true'`, `'yes'`) disables colour in output. (Manual smoke test once everything else compiles.)
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0; `npm run build` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `picocolors` (~600 bytes) honours the `NO_COLOR` env var per spec and `FORCE_COLOR`/TTY auto-detection.
- Keep ESM `import pc from 'picocolors'` style.

## Input Dependencies
None — `src/lib/log.ts` is independent of the other refactors.

## Output Artifacts
- Updated `package.json` (adds `picocolors`).
- Rewritten `src/lib/log.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `npm install picocolors --save` (or add the dep manually and run `npm install`). Pin the latest 1.x.
2. Replace `src/lib/log.ts` contents with:
   ```ts
   import pc from 'picocolors';

   type Level = 'info' | 'warn' | 'error' | 'success';

   const paint: Record<Level, (s: string) => string> = {
     info: pc.cyan,
     warn: pc.yellow,
     error: pc.red,
     success: pc.green,
   };

   function emit(level: Level, prefix: string, message: string): void {
     const line = `${paint[level](prefix)} ${message}`;
     if (level === 'error' || level === 'warn') {
       console.error(line);
     } else {
       console.log(line);
     }
   }

   export const log = {
     info: (msg: string): void => emit('info', '•', msg),
     warn: (msg: string): void => emit('warn', '!', msg),
     error: (msg: string): void => emit('error', '✗', msg),
     success: (msg: string): void => emit('success', '✓', msg),
     plain: (msg: string): void => console.log(msg),
   };
   ```
3. Verify: `npx tsc --noEmit && npm test && npm run build`.
4. Manual smoke (optional but recommended): build the CLI and run a no-op command with `NO_COLOR=true`, with `NO_COLOR=1`, and unset. The first two should produce uncoloured output; the third should produce coloured output when stdout is a TTY.

</details>
