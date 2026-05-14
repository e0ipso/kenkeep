---
id: 2
group: "capture-pipeline"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - unit-testing
---

# Cursory pre-filter at capture time with hardcoded thresholds

## Objective
Skip the proposal-drain pipeline for sessions that cannot have established a durable convention. Add three named-constant thresholds (`CURSORY_MAX_USER_TURNS = 1`, `CURSORY_MAX_USER_CHARS = 200`, `CURSORY_MAX_AGENT_CHARS = 500`), measure each in `captureSession`, and when the conjunction holds write the session log with `proposal_status: 'skipped'`, `proposal_error: 'cursory_session'`. Below threshold, behaviour is unchanged.

## Skills Required
- typescript: edit `src/lib/capture.ts`, export new constants from `src/lib/settings.ts`, and extend `renderSessionLog` in `src/lib/session-log.ts` to accept frontmatter overrides for `proposal_status` and `proposal_error`.
- unit-testing: add Vitest cases in `tests/lib/capture.test.ts` for the threshold conjunction and near-miss branches.

## Acceptance Criteria
- [ ] `CURSORY_MAX_USER_TURNS`, `CURSORY_MAX_USER_CHARS`, `CURSORY_MAX_AGENT_CHARS` are exported named constants from `src/lib/settings.ts` with the values `1`, `200`, `500`. No new `SettingsSchema` key, no `SETTINGS_DEFAULTS` addition, no `config.yaml` surface.
- [ ] `captureSession` measures `userTurns`, `userChars`, `agentChars` over `parsed.interleaved` after parsing the transcript and before writing the session log. The secret scan still runs unconditionally on the rendered slice.
- [ ] When `userTurns <= CURSORY_MAX_USER_TURNS && userChars <= CURSORY_MAX_USER_CHARS && agentChars <= CURSORY_MAX_AGENT_CHARS`, the written session log frontmatter has `proposal_status: skipped`, `proposal_error: cursory_session`, and `proposal_completed_at: <capturedAt>`. Otherwise the frontmatter retains today's `proposal_status: pending` / `proposal_error: null` / `proposal_completed_at: null` defaults.
- [ ] No new `CaptureStatus` enum value is added; the cursory path still returns `status: 'written'` (the frontmatter carries the distinction).
- [ ] Unit tests in `tests/lib/capture.test.ts` cover: (a) all three thresholds met → frontmatter is `skipped` + `cursory_session`; (b) one user turn, exactly 200 user chars, exactly 500 agent chars → still `skipped` (boundaries are inclusive); (c) 201 user chars (or 501 agent chars) → `pending`; (d) two user turns at low char counts → `pending`; (e) cursory branch still writes the file to disk and the secret-scan path still runs.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files to edit: `src/lib/settings.ts`, `src/lib/session-log.ts`, `src/lib/capture.ts`.
- Tests: `tests/lib/capture.test.ts` (existing).
- `ProposalStatusSchema` (in `src/lib/schemas.ts`) already accepts `'skipped'`; no schema change is needed.
- `renderSessionLog` (in `src/lib/session-log.ts`) currently hardcodes `proposal_status: pending` / `proposal_error: null` / `proposal_completed_at: null`; widen its input to accept optional overrides instead of patching the rendered string after the fact.

## Input Dependencies
None. (Plan 10's filesystem sweep — which ignores `proposal_status: 'skipped'` — is assumed to have already merged; this task only writes the frontmatter values and does not touch the worker.)

## Output Artifacts
- New constants exported from `src/lib/settings.ts`.
- `renderSessionLog` accepting optional `proposalStatus` / `proposalError` / `proposalCompletedAt` inputs.
- `captureSession` branching on the threshold conjunction and writing the cursory frontmatter through the existing renderer.
- New tests in `tests/lib/capture.test.ts`.

## Implementation Notes

<details>

### 1. Add the threshold constants

Append to `src/lib/settings.ts` (after the existing exports, near `SETTINGS_DEFAULTS`):

```ts
/**
 * Thresholds for the cursory-session pre-filter. A session matching all three
 * cannot have established a durable convention; the proposal worker is skipped.
 * Hardcoded by design — promoting these to config is a one-line change later.
 */
export const CURSORY_MAX_USER_TURNS = 1;
export const CURSORY_MAX_USER_CHARS = 200;
export const CURSORY_MAX_AGENT_CHARS = 500;
```

Do not add a `SettingsSchema` key or a `SETTINGS_DEFAULTS` entry. These are wrapper internals.

### 2. Extend `renderSessionLog` with optional overrides

In `src/lib/session-log.ts`, widen `SessionLogInput`:

```ts
export interface SessionLogInput {
  sessionId: string;
  capturedBy: CaptureTrigger;
  capturedAt: string;
  transcriptHash: string;
  secretScanStatus: SecretScanStatus;
  body: string;
  proposalStatus?: 'pending' | 'skipped';
  proposalError?: string | null;
  proposalCompletedAt?: string | null;
}
```

Replace the hardcoded frontmatter lines in the `lines` array with values derived from the inputs (defaulting to today's behaviour):

```ts
const proposalStatus = input.proposalStatus ?? 'pending';
const proposalError = input.proposalError ?? null;
const proposalCompletedAt = input.proposalCompletedAt ?? null;
```

…then:

```ts
`proposal_status: ${proposalStatus}`,
`proposal_completed_at: ${proposalCompletedAt === null ? 'null' : yamlString(proposalCompletedAt)}`,
`proposal_error: ${proposalError === null ? 'null' : yamlString(proposalError)}`,
```

Keep `proposal_log: null` as it is today.

### 3. Branch in `captureSession`

In `src/lib/capture.ts`, after `parsed` is obtained and after the secret scan completes (the secret scan must run unconditionally because the file is still written to disk):

```ts
import {
  CURSORY_MAX_USER_TURNS,
  CURSORY_MAX_USER_CHARS,
  CURSORY_MAX_AGENT_CHARS,
} from './settings.js';

const userSegments = parsed.interleaved.filter(s => s.role === 'user');
const agentSegments = parsed.interleaved.filter(s => s.role === 'agent');
const userTurns = userSegments.length;
const userChars = userSegments.reduce((n, s) => n + s.text.length, 0);
const agentChars = agentSegments.reduce((n, s) => n + s.text.length, 0);
const isCursory =
  userTurns <= CURSORY_MAX_USER_TURNS &&
  userChars <= CURSORY_MAX_USER_CHARS &&
  agentChars <= CURSORY_MAX_AGENT_CHARS;
```

Build the `renderSessionLog` arguments with the cursory frontmatter when `isCursory`:

```ts
const body = renderSessionLog({
  sessionId,
  capturedBy: trigger,
  capturedAt,
  transcriptHash: hash,
  secretScanStatus: scanResult.status,
  body: scanResult.status === 'redacted' ? scanResult.redactedText : slice,
  ...(isCursory
    ? {
        proposalStatus: 'skipped' as const,
        proposalError: 'cursory_session',
        proposalCompletedAt: capturedAt,
      }
    : {}),
});
```

Return value is unchanged: `status: 'written'`. The frontmatter on disk carries the cursory marker; the filesystem sweep (plan 10) filters on `proposal_status: 'pending'` and naturally ignores skipped files.

### 4. Tests

Extend `tests/lib/capture.test.ts`. Use a tmp directory for `sessionsDir` (look at existing tests in that file for the helper / pattern; reuse the same `now` and `scan` stubs). For each case, write a fixture transcript JSONL into a temp file (one JSON message per line; `{type:"user", message:{role:"user", content:"..."}}` shape), invoke `captureSession`, then read the written file and parse the frontmatter with `gray-matter`.

Cases:

| Case | userTurns | userChars | agentChars | Expected `proposal_status` | Expected `proposal_error` |
| --- | --- | --- | --- | --- | --- |
| All under | 1 | 5 | 50 | `skipped` | `cursory_session` |
| At boundary | 1 | 200 | 500 | `skipped` | `cursory_session` |
| One over user chars | 1 | 201 | 100 | `pending` | `null` |
| One over agent chars | 1 | 50 | 501 | `pending` | `null` |
| Two user turns | 2 | 10 | 50 | `pending` | `null` |

Also assert that, for the cursory case, `proposal_completed_at` is the `capturedAt` string (use the test's `now` stub) and that `secret_scan_status` is still recorded normally (i.e., the scan ran).

No need to test that the filesystem sweep skips skipped files; that lives in plan 10's tests.

</details>
