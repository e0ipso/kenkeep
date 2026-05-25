---
id: 1
group: "source-removal"
dependencies: []
status: "completed"
created: 2026-05-25
skills:
  - typescript
---
# Remove secretlint from source, hooks, and dependencies

## Objective
Delete the broken secretlint integration entirely: remove `src/lib/secret-scan.ts`, strip all scan/redaction code paths from capture, memory ingestion, schemas, session logs, and harness hooks, drop secretlint packages and config, and verify the project builds cleanly without secretlint in output bundles.

## Skills Required
TypeScript module removal and refactoring across the capture pipeline, schema types, and bundled hook sources.

## Acceptance Criteria
- [ ] `src/lib/secret-scan.ts` is deleted
- [ ] `src/lib/capture.ts` no longer imports or invokes scanning; `CaptureStatus` drops `secret-scan-blocked`; `CaptureResult` drops `secretScanStatus`; `CaptureContext` drops `scan`/`scanTimeoutMs`; captured text flows directly to `renderSessionLog`
- [ ] `src/lib/memory-files.ts` no longer imports `scanAndRedact`; `MemoryDiscoveryContext` drops `scanText`; file content passes through without a scanner
- [ ] `src/lib/schemas.ts` drops `SecretScanStatusSchema`, `SecretScanStatus`, and `secret_scan_status` from `SessionLogFrontmatterSchema`
- [ ] `src/lib/session-log.ts` drops `secretScanStatus` from input and rendered frontmatter
- [ ] All four `kb-capture.ts` hooks (claude, codex, cursor, opencode) drop the `secret-scan-blocked` branch
- [ ] `src/cli.ts` doctor description no longer mentions secret-scan availability
- [ ] `package.json` removes all `@secretlint/*` dependencies and devDependencies, the `"secretlint"` npm script, and the lint-staged `"*": ["secretlint"]` entry
- [ ] `.secretlintrc.json` is deleted
- [ ] `tsup.config.ts` comment no longer references `@secretlint/*` as bundled deps
- [ ] `npm install` refreshes `package-lock.json` with zero `@secretlint` entries
- [ ] `npm run build` succeeds
- [ ] `grep -r "secretlint" dist/ templates/` returns zero matches
- [ ] `npm ls @secretlint/core` shows the package is not installed

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript/ESM source under `src/`
- tsup bundling pipeline (`npm run build` runs `build:cli` + `build:templates`)
- Run `tsc --noEmit` after edits to catch stray imports of the deleted module

## Input Dependencies
None — this is the foundational removal task.

## Output Artifacts
- Deleted: `src/lib/secret-scan.ts`, `.secretlintrc.json`
- Modified: `src/lib/capture.ts`, `src/lib/memory-files.ts`, `src/lib/schemas.ts`, `src/lib/session-log.ts`, four `kb-capture.ts` hook sources, `src/cli.ts`, `package.json`, `package-lock.json`, `tsup.config.ts`
- Rebuilt: `dist/` and `templates/` hook bundles without secretlint code

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Delete `src/lib/secret-scan.ts`.
2. In `src/lib/capture.ts`:
   - Remove imports of `SecretScanner` and `scanAndRedact`.
   - Delete the scan invocation block (approximately lines 81-88).
   - Remove `'secret-scan-blocked'` from the `CaptureStatus` union.
   - Remove `secretScanStatus` from `CaptureResult`.
   - Remove `scan` and `scanTimeoutMs` from `CaptureContext`.
   - Pass captured text directly to `renderSessionLog` without intermediate scanning.
3. In `src/lib/memory-files.ts`:
   - Remove `scanAndRedact` import.
   - Remove `scanText` from `MemoryDiscoveryContext`.
   - Remove scanner initialization and the blocked check (approximately lines 138, 170-174).
   - Use file content directly.
4. In `src/lib/schemas.ts`:
   - Delete `SecretScanStatusSchema` and `SecretScanStatus` type.
   - Remove `secret_scan_status` from `SessionLogFrontmatterSchema`.
5. In `src/lib/session-log.ts`:
   - Remove `SecretScanStatus` import.
   - Remove `secretScanStatus` from `SessionLogInput`.
   - Remove the `secret_scan_status` line from rendered frontmatter.
6. In each harness hook file (`src/harnesses/{claude,codex,cursor,opencode}/hooks/kb-capture.ts`):
   - Remove the `secret-scan-blocked` status branch.
7. In `src/cli.ts`:
   - Update the doctor command description comment (approximately line 65) to remove secret-scan wording.
8. In `package.json`:
   - Remove `@secretlint/config-loader`, `@secretlint/core`, `@secretlint/secretlint-rule-preset-recommend` from `dependencies`.
   - Remove `secretlint` and `@secretlint/secretlint-rule-preset-recommend` from `devDependencies`.
   - Remove the `"secretlint"` script.
   - Remove the `"*": ["secretlint"]` lint-staged entry.
9. Delete `.secretlintrc.json`.
10. In `tsup.config.ts`, update the bundled-deps comment (approximately line 97) to drop `@secretlint/*`.
11. Run `npm install` to refresh the lockfile.
12. Run `npm run typecheck` and fix any stray imports.
13. Run `npm run build`.
14. Verify: `grep -r "secretlint" dist/ templates/` returns nothing; `npm ls @secretlint/core` reports not installed.

</details>
