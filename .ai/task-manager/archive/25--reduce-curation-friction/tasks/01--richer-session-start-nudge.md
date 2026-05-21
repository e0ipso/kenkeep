---
id: 1
group: "session-start-nudge"
dependencies: []
status: "completed"
created: 2026-05-21
skills:
  - typescript
  - vitest
---
# Implement richer SessionStart nudge (soft + loud forms)

## Objective
Replace the current single-line "you have N pending session log(s)" nudge with a structured block that surfaces pending session count, total candidate proposals, age of oldest pending log, and a copy/paste command. Add a loud-form variant that triggers when the queue is both populous AND stale (or very populous), while keeping the existing 1-hour throttle.

## Skills Required
- `typescript`: edits to `src/lib/session-start.ts` and its callers as needed
- `vitest`: extend `tests/lib/session-start.test.ts` to cover soft/loud/throttle paths

## Acceptance Criteria
- [ ] `buildSessionStartContext` returns the same `SessionStartResult` shape (no breaking interface change for callers) but the `additionalContext` now includes, when the nudge fires:
  - pending session count
  - total candidate-proposal count (sum of `proposals.practice[]` + `proposals.map[]` across pending sessions)
  - age of oldest pending log in days (rounded down, "today" if < 24h)
  - a copy/paste one-liner (`/kb-curate` or `npx @e0ipso/ai-knowledge-base curate`)
- [ ] Soft-form nudge (≥ `threshold` pending, NOT stale) renders as a three-line block.
- [ ] Loud-form nudge fires when `pending ≥ threshold AND oldestAgeDays ≥ staleDays`, OR when `pending ≥ 2 × threshold`. It uses a visually delineated heading (`> 🔔 KB curation queue is overdue`) and includes the age phrase.
- [ ] Defaults: `threshold = 5` (unchanged), new `staleDays = 7`. Both surfaced via `SessionStartContext` for tests; no config.yaml plumbing for v1.
- [ ] Existing 1-hour throttle (`NUDGE_THROTTLE_MS`) still gates nudge emission and `last_nudged_at` persistence; throttle applies to BOTH soft and loud forms.
- [ ] `countPendingSessions` extended (or a sibling helper added) so a single pass over `_sessions/*.md` returns `{ pending, candidateCount, oldestCapturedAt }`. No second walk of the directory.
- [ ] `tests/lib/session-start.test.ts` covers: soft form output shape, loud form age trigger, loud form 2×threshold trigger, throttle suppresses loud form, no-pending case unchanged, candidate-count aggregation correctness.
- [ ] `npx vitest run tests/lib/session-start.test.ts` passes.
- [ ] `npm run lint` and `npm run typecheck` (or project equivalents — see `package.json`) pass on changed files.

## Technical Requirements
- File: `/workspace/src/lib/session-start.ts`
- Existing constants to keep: `DEFAULT_NUDGE_THRESHOLD = 5`, `NUDGE_THROTTLE_MS = 3600000`
- Add: `DEFAULT_STALE_DAYS = 7`
- The session log frontmatter schema lives at `/workspace/src/lib/schemas.ts` — `SessionLogFrontmatterSchema`. Inspect it to confirm fields `proposal_status`, `captured_at`, and `proposals.{practice,map}[]` are reachable. If the schema does not validate proposal arrays, fall back to reading raw frontmatter via `gray-matter` and treating missing arrays as empty.
- Test fixtures helper: `/workspace/tests/lib/session-start.test.ts` already has setup helpers for writing synthetic session-log files. Reuse them.

## Input Dependencies
None. This is independent of the SKILL.md changes.

## Output Artifacts
- Modified `/workspace/src/lib/session-start.ts`
- Updated `/workspace/tests/lib/session-start.test.ts`
- Possibly modified type exports if `SessionStartContext` gains `staleDays?: number`

## Implementation Notes

<details>

**1. Extend the single-pass session walk.** Today `countPendingSessions(sessionsDir)` returns a `number`. Add a `summarizePendingSessions(sessionsDir): { pending: number; candidateCount: number; oldestCapturedAt: Date | null }` and have `buildSessionStartContext` call the new helper. Keep `countPendingSessions` exported as a thin wrapper for back-compat with any test or external caller that imports it (grep first — if nothing imports it, remove it).

**2. Read proposals safely.** The session log frontmatter may have `proposals: { practice: [...], map: [...] }` or may have either array absent. Use:
```ts
const fm = SessionLogFrontmatterSchema.safeParse(matter(read).data);
const proposals = fm.success ? fm.data.proposals : undefined;
const count = (proposals?.practice?.length ?? 0) + (proposals?.map?.length ?? 0);
```
If the schema parse fails, count 0 for that file and continue (do not throw — a single malformed session log should not break the SessionStart hook).

**3. Compute oldest age.** Track the minimum `captured_at` across pending sessions. Convert to days via `Math.floor((now - oldestCapturedAt) / 86_400_000)`. If 0, render as "today".

**4. Two render modes.** Pseudocode for the nudge block:
```
if !shouldNudge -> nothing
oldestPhrase = oldestAgeDays === 0 ? "captured today" : `oldest pending: ${oldestAgeDays} day(s)`
copyPaste = "Run `/kb-curate` (or `npx @e0ipso/ai-knowledge-base curate`)"

if loud:
  > 🔔 KB curation queue is overdue
  > {pending} pending session log(s), {candidateCount} candidate proposal(s), {oldestPhrase}
  > {copyPaste}
else (soft):
  > {pending} pending session log(s), {candidateCount} candidate proposal(s), {oldestPhrase}
  > {copyPaste}
```
The exact glyph (🔔) is fine but not load-bearing — the test should assert presence of the heading literal "KB curation queue is overdue", not the emoji.

**5. Trigger logic.** `loud = pending >= threshold && oldestAgeDays >= staleDays || pending >= 2 * threshold`. Note operator precedence — wrap the AND clause: `loud = (pending >= threshold && oldestAgeDays >= staleDays) || pending >= 2 * threshold`. `shouldNudge` remains `pending >= threshold && !throttled` regardless of loud/soft.

**6. State persistence.** Same as today: write `last_nudged_at` when a nudge (soft OR loud) emits.

**7. Tests.** At minimum add cases:
- 5 pending, all captured today → soft form, no loud heading.
- 5 pending, oldest 8 days back → loud form, heading present, age phrase "8 day(s)".
- 10 pending, all today → loud form via 2×threshold path.
- 5 pending, oldest 8 days back, but `last_nudged_at = 30 min ago` → throttled, no block.
- 5 pending, one session has malformed frontmatter → still emits soft nudge, count reflects the 5 valid sessions.

**8. Lint / format.** Run `npm run lint` and `npm run format` (or whatever the project uses — check `package.json` scripts). No trailing whitespace; newline at EOF.

</details>
