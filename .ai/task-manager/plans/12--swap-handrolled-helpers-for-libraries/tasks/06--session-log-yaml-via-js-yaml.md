---
id: 6
group: "library-swaps"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Render session-log frontmatter via js-yaml dump

## Objective
Replace the hand-rolled YAML emission in `src/lib/session-log.ts` with `js-yaml`'s `dump` for the frontmatter body, retaining the manual `---` framing and the existing body sections. `js-yaml` is already a runtime dependency, so this adds no new package.

## Skills Required
- `typescript`: small library swap; preserve emitted-output equivalence as much as possible.

## Acceptance Criteria
- [ ] `src/lib/session-log.ts` imports `dump` from `js-yaml` and uses it inside `renderSessionLog`.
- [ ] The local `yamlString(value)` helper is deleted.
- [ ] The rendered string still starts with `---\n` and contains a `---\n` closing fence before `\n## Transcript\n...`. The body sections (`## Transcript`, the trimmed body, `## Proposal`, the placeholder line) remain unchanged.
- [ ] The frontmatter object passed to `dump` includes the same keys and nesting as today: `schema_version`, `session_id`, `captured_by`, `captured_at`, `transcript_hash`, `proposal_status`, `proposal_completed_at`, `proposal_error`, `proposal_log`, `secret_scan_status`, `proposals: { practice: [], map: [] }`. Null fields are emitted as `null`.
- [ ] `tests/lib/session-log.test.ts` passes. Where existing tests assert exact byte sequences, update them to either (a) compare structural equality after parsing with `gray-matter`, or (b) match the new `js-yaml` formatting verbatim. Prefer structural equality.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0; `npm run build` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `js-yaml` `dump` options: `{ lineWidth: -1, noRefs: true, sortKeys: false }` to preserve insertion order, avoid line-wrapping surprises, and suppress YAML anchor references.
- Manual `---` framing on either side of the dumped body.

## Input Dependencies
None — `session-log.ts` is independent of the other refactors.

## Output Artifacts
- Updated `src/lib/session-log.ts` (rewritten `renderSessionLog` + deletion of `yamlString`).
- Possibly updated `tests/lib/session-log.test.ts` if existing assertions checked byte-exact frontmatter formatting.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open `src/lib/session-log.ts` and:
   - Add `import { dump } from 'js-yaml';` at the top (after the `node:fs` import).
   - Rewrite `renderSessionLog`:
     ```ts
     export function renderSessionLog(input: SessionLogInput): string {
       const frontmatter = {
         schema_version: 1,
         session_id: input.sessionId,
         captured_by: input.capturedBy,
         captured_at: input.capturedAt,
         transcript_hash: input.transcriptHash,
         proposal_status: 'pending',
         proposal_completed_at: null,
         proposal_error: null,
         proposal_log: null,
         secret_scan_status: input.secretScanStatus,
         proposals: { practice: [], map: [] },
       };
       const yaml = dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
       const bodyLines = [
         '## Transcript',
         '',
         input.body.trimEnd(),
         '',
         '## Proposal',
         '',
         '(populated by proposal worker)',
         '',
       ];
       return `---\n${yaml}---\n${bodyLines.join('\n')}`;
     }
     ```
   - Delete the `yamlString` helper.
2. Run `tests/lib/session-log.test.ts`. If assertions fail because `js-yaml` quotes strings differently than the old hand-rolled emitter (e.g., unquoted vs `"…"`), prefer to update the test to parse the rendered string with `gray-matter` and compare the data object; only fall back to updating byte-exact fixtures if that approach isn't workable.
3. Confirm that `kb-capture` and `kb-proposal-drain` hook bundles still build (`npm run build`). The `js-yaml` import was already pulled into kb-capture's bundle indirectly via `session-log.ts`'s downstream consumers; record any observable bundle-size change if material.
4. Run the full suite: `npx tsc --noEmit && npm test && npm run build`.

</details>
