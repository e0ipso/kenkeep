---
id: 19
summary: "Move two preprocessing tasks out of the proposal-extract prompt into the wrapper: deterministically tag /self-review-apply turns in the role-tagged transcript, and pre-filter cursory single-turn sessions before they reach the LLM"
created: 2026-05-13
---

# Plan: Pre-tag self-review-apply turns and pre-filter cursory sessions

## Original Work Order

> The proposal-extract prompt spends a lot of ink on two preprocessing tasks the wrapper could do deterministically before the LLM ever runs: detecting `/self-review-apply` trigger turns (a regex over the role-tagged transcript) and identifying "cursory" single-turn sessions that cannot have established a durable convention (a turn-count + content-length threshold). Both belong upstream so the prompt can shrink and the LLM only has to make the judgement calls that actually need a model.
>
> Acceptance criteria from the issue body cover: deterministic pre-tag in `renderRoleTagged` (`src/lib/transcript.ts:77`), regex `/^\[USER\]:\s*\/self-review-apply\s+\S+\.xml\s*$/m`, trimming `src/templates-source/prompts/proposal-extract.md:102-107` and the inline aside at line 219, a cursory-detection step keyed on 1 user turn + total user content ≤200 chars + total agent content ≤500 chars, writing the skipped session log with `proposal_status: skipped` and `proposal_error: cursory_session`, dropping the cursory bullet from `proposal-extract.md:16-32`, and bumping `Version: N`.
>
> Source notes: `08-proposal-extract-self-review-apply-detection.md` and `11-proposal-cursory-session-pre-filter.md`.

## Plan Clarifications

| Question | Answer |
| --- | --- |
| Where does the deterministic pre-tag live? | Inside `renderRoleTagged`. The session log body on disk and the LLM input share the same tagged text; one implementation, no drift. |
| Does the cursory filter include an imperative-correction guard? | No. Threshold alone. A short genuine teaching moment may be skipped; the issue accepts the risk. |
| Coupling with plan 10? | Assume plan 10 lands first. The pre-filter writes `proposal_status: skipped` and the new filesystem sweep ignores it; no queue interaction needed. |
| Where do the cursory thresholds live? | Hardcoded named constants in `src/lib/settings.ts` (or a sibling module). Not surfaced through `config.yaml`. |
| Are stale "five non-productive shapes" mentions in the prompt edited? | Yes. Every count and reference to the cursory shape is updated; the gate-decision paragraph and surrounding commentary are reread to confirm the prompt still parses with four shapes. |

## Executive Summary

Two preprocessing tasks currently inside the `proposal-extract` prompt are mechanical and belong in the wrapper. The first is detecting `/self-review-apply` invocations: the prompt invests a paragraph reminding the model that the XML filename varies and re-iterates the same point in an inline example, all so the model can do a regex match it can read off a tag instead. The second is the "cursory" gate, a session-disposition reject that asserts a single short turn cannot have established a durable convention; this is exactly the case where the Stop hook re-fires many times for the same session and the wrapper pays repeatedly for a per-turn LLM call to produce an empty proposal.

The change moves both upstream. `renderRoleTagged` rewrites `[USER]:` segments matching the slash-command regex into `[USER /self-review-apply <path>]:` markers, and stamps the next `[AGENT]:` segment as `[AGENT NARRATION OF SELF-REVIEW <path>]:`. `captureSession` measures turn counts and content lengths against three named thresholds; when all three fire, the session log is written with `proposal_status: skipped` and `proposal_error: 'cursory_session'`, no enqueue, no `claude -p` spawn. The prompt's self-review-apply section shrinks to a one-line reference to the new tag and its cursory bullet is removed; the prompt `Version:` line is bumped per `practice-prompt-versioning`.

Outcomes: the prompt loses about twenty lines of mechanical guidance, the LLM stops paying for empty-output runs on trivial single-turn sessions, and the tagger becomes a hedge for future slash commands worth highlighting.

## Context

### Current State vs Target State

| Current State | Target State | Why? |
| --- | --- | --- |
| `renderRoleTagged` emits `[USER]: <text>` / `[AGENT]: <text>` only; the LLM is asked to spot `/self-review-apply <path>.xml` against a variable filename | `renderRoleTagged` rewrites the matched user segment to `[USER /self-review-apply <path>]: ...` and stamps the following agent segment as `[AGENT NARRATION OF SELF-REVIEW <path>]: ...` | Structural detection (regex over a role-tagged transcript) does not need a model; the tagger is the hedge for future high-signal slash commands |
| `proposal-extract.md:102-107` carries a paragraph plus a per-filename caveat about `/self-review-apply`, and `:219` repeats the caveat inline in the example | One sentence: "When you see a `[USER /self-review-apply ...]:` tag, treat each narrated change in the following agent turn as a candidate corrective signal." The inline example aside collapses to a reference to the tag. | The variable filename is the only thing the prompt's old wording defended; the tagger removes the need to defend it |
| Every Stop fire on a trivial single-turn session pays the full proposal-drain cost: read prompt, render transcript, spawn `claude -p`, schema-validate empty output, write `done` with empty arrays | `captureSession` measures turn counts and lengths up front; when all three hardcoded thresholds match, the session log lands with `proposal_status: 'skipped'`, `proposal_error: 'cursory_session'`, and the proposal worker never sees it | Pure noise sessions never reach the LLM; the documented behaviour of the gate (produce nothing) is achieved deterministically |
| `proposal-extract.md:16-32` lists five non-productive session shapes; the cursory bullet asserts a structural property the wrapper can decide; the gate text counts to five throughout | The cursory bullet is removed; every "five" count and downstream reference is rewritten to four; the gate-decision paragraph and inline commentary stay coherent with the four remaining shapes (abandoned, exploratory, unrelated, meta-only) | Consistency: a shape the wrapper enforces before the prompt runs cannot also be listed as a shape the prompt rejects |
| Prompt header reads `Version: 2` | Prompt header reads `Version: 3` | `practice-prompt-versioning`: every behaviour change to a prompt bumps the version |

### Background

- The transcript flows in one direction: `parseTranscriptJsonl` produces an interleaved list of `{role, text}` segments; `renderRoleTagged` flattens them to the `[ROLE]: text` shape consumed both as the session log body (via `captureSession`) and as the LLM input (via `extractTranscript` inside `drainProposalQueue`). Tagging at the renderer is the only place that reaches both call sites in one edit.
- The cursory filter measures content the wrapper already has in hand at capture time: `parsed.interleaved` from `parseTranscriptJsonl`. No new transcript walk is needed; the thresholds are a sum-and-compare over the same array `renderRoleTagged` consumes.
- The proposal-status frontmatter field already accepts `'skipped'` (see `ProposalStatusSchema` in `src/lib/schemas.ts:9`); no schema change is required.
- Plan 10 replaces the per-entry `.queue.json` with a filesystem sweep over `_sessions/*.md` whose frontmatter has `proposal_status: 'pending'`. Writing `proposal_status: 'skipped'` from capture naturally falls out of the sweep. This plan assumes that change has merged; the cursory path therefore contains no queue interaction.
- The `/self-review-apply` regex per the issue is `/^\[USER\]:\s*\/self-review-apply\s+\S+\.xml\s*$/m`. The `^...$` anchors plus the `m` flag bind to a single rendered segment; whitespace tolerance handles trailing spaces or newlines without permitting prose. The `\S+\.xml` clause is a path, not a filename match, and is captured for use in the rewritten tag.

## Architectural Approach

The work splits into three local edits: the transcript renderer learns one rewriting rule, the capture path adds a precondition before write, and the prompt loses two sections plus has its `Version:` bumped. None of the edits cross more than two files. The flow becomes:

```mermaid
graph TD
  A[parseTranscriptJsonl] --> B[interleaved segments]
  B --> C{renderRoleTagged}
  C -->|tag rewrite| D[role-tagged text with [USER /self-review-apply ...] markers]
  B --> E{captureSession cursory check}
  E -->|threshold matched| F[write session log with proposal_status: skipped, proposal_error: cursory_session]
  E -->|threshold not matched| G[write session log with proposal_status: pending]
  D --> G
  G --> H[filesystem sweep picks up pending]
  F --> I[sweep ignores skipped]
  H --> J[proposal-extract prompt v3: one sentence about [USER /self-review-apply ...] tag, four non-productive shapes]
```

### Deterministic tag rewrite in renderRoleTagged

**Objective**: Annotate the rendered transcript with explicit trigger markers so the prompt can drop its filename-variance defence and treat the tag as a fixed token.

`renderRoleTagged` (`src/lib/transcript.ts:73-77`) currently maps each segment to `[ROLE]: text` and joins with double newlines. The new behaviour is the same join, but with a single rewriting pass over the segment array before the join: when segment `i` is a user segment whose text matches `/^\s*\/self-review-apply\s+(\S+\.xml)\s*$/`, rewrite its `[USER]: ...` rendering to `[USER /self-review-apply <captured-path>]: <original text>`, and rewrite segment `i+1`, if it is an agent segment, to `[AGENT NARRATION OF SELF-REVIEW <captured-path>]: <original text>`. The original body text is preserved in both cases; only the role marker carries the additional annotation.

Detection runs against the raw segment text (without the `[USER]: ` prefix), which is what `renderRoleTagged` already holds. The issue's regex `/^\[USER\]:\s*\/self-review-apply\s+\S+\.xml\s*$/m` matches the rendered form; the equivalent matching the unrendered segment is `/^\s*\/self-review-apply\s+(\S+\.xml)\s*$/`, which is the form actually applied. The captured group becomes the path inside the tag.

The agent-segment annotation handles the typical pattern of a `/self-review-apply` user turn immediately followed by an agent narration. If the next segment is anything other than an agent segment (rare; only possible at the end of a transcript or in malformed input), the annotation is simply skipped: the user tag still carries the information and the prompt's per-narrated-change instructions degrade to no-ops.

### Cursory pre-filter at capture time

**Objective**: Skip the proposal-drain pipeline for sessions that cannot have established a durable convention.

`captureSession` (`src/lib/capture.ts:56`) already parses the transcript via `parseTranscriptJsonl` and renders it via `renderRoleTagged`. After `parsed` is obtained and before `slice` is written, the function measures:

- `userTurns`: count of segments with `role === 'user'`.
- `userChars`: sum of `text.length` over user segments.
- `agentChars`: sum of `text.length` over agent segments.

The thresholds live as named constants exported from `src/lib/settings.ts` (or a new `src/lib/cursory.ts` if `settings.ts` is reserved for resolved-config concerns): `CURSORY_MAX_USER_TURNS = 1`, `CURSORY_MAX_USER_CHARS = 200`, `CURSORY_MAX_AGENT_CHARS = 500`. The trigger is the conjunction of all three.

When the conjunction holds, the session log is rendered with the existing `renderSessionLog` helper, but the frontmatter is patched to `proposal_status: 'skipped'`, `proposal_error: 'cursory_session'`, `proposal_completed_at: capturedAt`, `proposal_log: null`, and `proposals: { practice: [], map: [] }`. The file lands on disk for inspection; no append-to-queue, no claude -p spawn (which, post-plan-10, are gone anyway; the explicit point is that the filesystem sweep filtering on `proposal_status: 'pending'` skips this file naturally).

`renderSessionLog` and `writeSessionLog` are reused as-is; the only new thing in `captureSession` is the conjunction check and a small branch that selects the frontmatter values written through the existing renderer. No new `CaptureStatus` value is introduced; `'written'` covers both pending and skipped writes (callers do not need to distinguish them; the frontmatter carries the distinction).

When the conjunction does not hold, behaviour is unchanged.

The secret scan runs unconditionally, before the cursory check, because the file is still written to disk and a leak in a 199-character user turn is still a leak.

### Prompt edits: trim two sections, bump version, sweep counts

**Objective**: Remove the work the wrapper now does and keep the prompt's gate logic internally consistent.

`src/templates-source/prompts/proposal-extract.md` edits:

- **Header (`Version: 2` to `Version: 3`).** Per `practice-prompt-versioning`.
- **Lines 16-32 (the five non-productive shapes).** The cursory bullet is removed. The "Five non-productive shapes" sentence becomes "Four non-productive shapes apply, each a whole-session reject: abandoned, exploratory, unrelated, and meta-only." Any later text that names "five" (gate-decision paragraph at line 28, confidence-bias rule, scope clarification) is reread and rewritten to "four" where the count surfaces.
- **Lines 102-107 (self-review-apply section).** The paragraph and its filename-variance caveat collapse to one sentence: "When you see a `[USER /self-review-apply ...]:` tag, treat each narrated change in the following agent turn as a candidate corrective signal. Apply both the corrective-pattern rule and the task-specific filter to each narrated change independently."
- **Lines 217-256 (inline example for self-review-apply).** The example is kept (it shows the kept-vs-dropped judgement, which is still the model's job) but updated: the input transcript now starts with `[USER /self-review-apply feedback/round-2.xml]:` and the next line begins `[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]:`. The aside that explained variable filenames is removed; the surrounding commentary mentions the tag rather than the regex.
- **No new prompt content.** The prompt does not learn anything new; it forgets two things.

### Hardcoded threshold constants

**Objective**: Make the thresholds tunable by code edit, not configuration.

A small named-export block in `src/lib/settings.ts` (or a sibling `src/lib/cursory.ts` if grouping by concern is preferred):

```
export const CURSORY_MAX_USER_TURNS = 1;
export const CURSORY_MAX_USER_CHARS = 200;
export const CURSORY_MAX_AGENT_CHARS = 500;
```

No new `SettingsSchema` key, no addition to `SETTINGS_DEFAULTS`, no `config.yaml` surface. The justification is that these thresholds are wrapper internals; if they ever do need to be tuned by users, that change is a one-line addition later.

## Risk Considerations and Mitigation Strategies

<details>
<summary>Technical Risks</summary>

- **Genuine short teaching moments get skipped.** A single 60-character user turn ("never commit the .env file") followed by a 200-character agent acknowledgement matches every threshold and is dropped without LLM review.
    - **Mitigation**: Accepted per clarification. The thresholds are conservative on the agent side (500 chars is meaningful; pure acknowledgement is shorter). If false-skip rate proves high in practice, the imperative-correction guard mentioned in the source notes is a future addition; this plan does not include it.
- **Tag rewrite collides with prose that quotes the tag.** If a user turn quotes the literal string `/self-review-apply foo.xml` inside a longer message, the regex anchored at line start with `m` flag inside a multi-line segment text could spuriously match.
    - **Mitigation**: The regex anchors with `^...$` and the `m` flag binds to the segment text, not the rendered transcript; the segment text is a single user message body. A quoted invocation buried in prose is on a line by itself only if the user typed it that way. The risk is low and the failure is benign (the tag is added; the prompt still reads the surrounding body).
- **Agent annotation lands on a non-narration agent turn.** If a `/self-review-apply` user turn is followed by an agent turn that is not a narration (rare in practice but possible if the agent asks a clarifying question first), the `[AGENT NARRATION OF SELF-REVIEW ...]:` tag mislabels its content.
    - **Mitigation**: The tag describes the user's intent for the turn, not a guarantee about agent behaviour. The prompt's per-narrated-change instructions still work: zero narrated changes means zero candidates, which is the correct output.

</details>

<details>
<summary>Implementation Risks</summary>

- **Session log body on disk now carries the new tag.** Existing session logs in `_sessions/` were written with the old `[USER]:` form; tooling that diffs old vs new sessions sees a one-time format break.
    - **Mitigation**: Per user standing rule, no migration. The session logs are append-only inspection artefacts; no consumer parses them after capture except the proposal worker, which now expects the new form.
- **Stale "five" count drift in the prompt.** The prompt mentions the count of non-productive shapes in several places (gate-decision paragraph, confidence-bias rule, scope clarification). Updating only the bullet list leaves the prompt internally inconsistent.
    - **Mitigation**: Per clarification, the prompt is swept end to end for every count and reference to the cursory shape; the gate-decision paragraph and downstream commentary are reread to confirm coherence.

</details>

<details>
<summary>Quality Risks</summary>

- **Test coverage gap for the cursory path.** Existing tests exercise the full capture-to-proposal flow; a new branch in `captureSession` needs explicit coverage for the threshold conjunction and for each below-threshold near-miss (one turn but 201 user chars, exactly one turn and exactly 200 chars, etc.).
    - **Mitigation**: Add unit tests for `captureSession` covering: threshold matched (writes skipped frontmatter, no queue interaction); user-chars over threshold (writes pending); agent-chars over threshold (writes pending); two user turns (writes pending). Add unit tests for `renderRoleTagged` covering: no slash command (unchanged), slash command with following agent turn (both tagged), slash command with no following segment (only user tagged), unrelated `[USER]:` text containing the literal `/self-review-apply` word inside a longer body (not tagged).

</details>

## Success Criteria

### Primary Success Criteria

1. `renderRoleTagged` emits `[USER /self-review-apply <path>]: ...` and `[AGENT NARRATION OF SELF-REVIEW <path>]: ...` for the canonical pair, and the existing `[USER]: ...` / `[AGENT]: ...` shape for everything else.
2. `captureSession` writes a session log with frontmatter `proposal_status: 'skipped'` and `proposal_error: 'cursory_session'` when, and only when, the conjunction of three thresholds holds.
3. `CURSORY_MAX_USER_TURNS`, `CURSORY_MAX_USER_CHARS`, and `CURSORY_MAX_AGENT_CHARS` are exported named constants used by `captureSession`; no new key is added to `SettingsSchema` or to the default `config.yaml`.
4. `src/templates-source/prompts/proposal-extract.md` reads `Version: 3`, lists four non-productive session shapes, and contains exactly one sentence about the `[USER /self-review-apply ...]:` tag.
5. `npm run lint`, `npm run typecheck`, and `npm test` pass.

## Self Validation

1. Run `rg -n "five non-productive|five whole-session|five shapes" src/templates-source/prompts/proposal-extract.md` and confirm zero hits.
2. Run `rg -n "Version: 3" src/templates-source/prompts/proposal-extract.md` and confirm one hit at the file header.
3. Run `rg -n "CURSORY_MAX_USER_TURNS|CURSORY_MAX_USER_CHARS|CURSORY_MAX_AGENT_CHARS" src/` and confirm each constant is defined once and consumed in `captureSession`.
4. Run `rg -n "cursory|CURSORY" src/templates-source/prompts/proposal-extract.md` and confirm zero hits (the prompt no longer references the shape).
5. Construct a transcript fixture with two segments: `[USER]: /self-review-apply feedback/round-2.xml` followed by `[AGENT]: I worked through the review comments...` (one agent paragraph, 400 chars). Call `parseTranscriptJsonl` then `renderRoleTagged`; assert the rendered text begins with `[USER /self-review-apply feedback/round-2.xml]:` and the next role marker is `[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]:`.
6. Construct a transcript with one user turn (`"ok"`, 2 chars) and one agent turn (`"sure"`, 4 chars). Call `captureSession` against an in-memory `sessionsDir`. Read the written file with `gray-matter`; assert `data.proposal_status === 'skipped'` and `data.proposal_error === 'cursory_session'`.
7. Construct a transcript with one user turn at exactly 201 chars and one agent turn at 100 chars. Call `captureSession`. Assert `data.proposal_status === 'pending'` (the conjunction does not hold).
8. Construct a transcript with two user turns of 5 chars each and one agent turn of 50 chars. Call `captureSession`. Assert `data.proposal_status === 'pending'` (user turn count fails).
9. Spawn a real Claude Code session that fires Stop after a single short user turn ("hi"). Inspect the latest file in `.ai/knowledge-base/_sessions/`; assert its frontmatter has `proposal_status: skipped` and `proposal_error: cursory_session`, and no `proposal_log` is set.
10. Spawn a real Claude Code session that uses `/self-review-apply <some>.xml`. Inspect the captured session log body; confirm the role markers carry the `[USER /self-review-apply ...]:` and `[AGENT NARRATION OF SELF-REVIEW ...]:` annotations.

## Documentation

- Update the inline `Used by:` comment block at the top of `proposal-extract.md` if it references the cursory shape or the filename-variance caveat (it does not in the current text, but verify after the rewrite).
- Update `AGENTS.md` or any `.claude/skills/kb-*/` README that describes the proposal-extract gate as having "five non-productive shapes" to read "four". If no such reference exists, skip this step.
- Add a `practice-` node only if the curator finds genuine new convention worth recording; this plan does not pre-write knowledge-base content.

This plan does not require a new public-facing documentation page.

## Execution Blueprint

**Validation Gates:**
- Reference: `/config/hooks/POST_PHASE.md`

### ✅ Phase 1: Wrapper preprocessing + prompt trim
**Parallel Tasks:**
- ✔️ Task 001: Deterministically tag /self-review-apply turns in renderRoleTagged
- ✔️ Task 002: Cursory pre-filter at capture time with hardcoded thresholds
- ✔️ Task 003: Trim proposal-extract prompt, collapse self-review-apply section, bump Version

```mermaid
graph TD
  001[Task 001: Pre-tag in renderRoleTagged]
  002[Task 002: Cursory pre-filter in captureSession]
  003[Task 003: Prompt trim and Version 3]
```

No edges: all three tasks touch independent files and may run concurrently.

### Post-phase Actions
- Manually run the two end-to-end validation steps (steps 9-10 in the plan's "Self Validation" section) once all three tasks are merged.

### Execution Summary
- Total Phases: 1
- Total Tasks: 3

## Resource Requirements

### Development Skills

- TypeScript / Node.js.
- Familiarity with `gray-matter` frontmatter editing.
- Vitest (or the repo's test runner) for unit tests around `renderRoleTagged` and `captureSession`.

### Technical Infrastructure

- Local Node.js toolchain (`npm`, `tsc`, lint, test).
- A Claude Code session for the two end-to-end validation steps.

## Integration Strategy

The change is internal to the knowledge-base builder. The CLI surface is unchanged. The session log format gains two new role markers but the existing markers are untouched, so consumers that grep for `[USER]:` continue to match (the new marker contains the old prefix as a substring). The proposal-extract prompt's contract (one JSON object with `practice` and `map` arrays) is unchanged.

## Notes

- The tagger is small enough that introducing a separate `annotateTriggers` helper would add ceremony without payoff; keeping the rewrite inside `renderRoleTagged` matches the user's clarification that the session log and the LLM input should not drift.
- The cursory thresholds are named constants rather than config because the wrapper internals do not benefit from a YAML surface. If a future session shows the false-skip rate is too high in practice, promoting them to config is a one-line addition; YAGNI applies here.
- The four-shape rewrite of the prompt is the only documentation work; the change does not need a new README or guide.

## Execution Summary

**Status**: ✅ Completed Successfully
**Completed Date**: 2026-05-14

### Results

Phase 1 executed all three tasks in parallel, then a single commit landed
the change on `feature/19--pre-tag-and-pre-filter`.

- `renderRoleTagged` now rewrites a `/self-review-apply <path>.xml` user
  segment to `[USER /self-review-apply <path>]:` and stamps the following
  agent segment as `[AGENT NARRATION OF SELF-REVIEW <path>]:`. Non-trigger
  segments render unchanged.
- `captureSession` measures `userTurns`, `userChars`, `agentChars` over
  `parsed.interleaved` after the secret scan and, when all three thresholds
  hold, writes the session log with `proposal_status: skipped`,
  `proposal_error: cursory_session`, and `proposal_completed_at:
  capturedAt`.
- Three named constants (`CURSORY_MAX_USER_TURNS = 1`,
  `CURSORY_MAX_USER_CHARS = 200`, `CURSORY_MAX_AGENT_CHARS = 500`) live in
  `src/lib/settings.ts`; no `SettingsSchema` key or `config.yaml` surface
  was added.
- `renderSessionLog` accepts optional `proposalStatus`, `proposalError`,
  `proposalCompletedAt` inputs, defaulting to today's behaviour.
- `src/templates-source/prompts/proposal-extract.md` now reads
  `Version: 3`, lists four non-productive shapes, collapses the
  self-review-apply section to one sentence keyed off the new tag, and
  rewrites the inline example to use the tagged role markers.
- Vitest coverage extends `tests/lib/transcript.test.ts` and
  `tests/lib/capture.test.ts` with the renderer paths and the threshold
  conjunction (boundary and near-miss cases).

Self-validation greps confirmed: zero hits on "five non-productive",
exactly one `Version: 3` in the prompt header, the three CURSORY
constants defined once and consumed in `captureSession`, zero
`cursory`/`CURSORY` mentions in the prompt. `npm run lint`,
`npm run typecheck`, and `npm test` (229 tests across 30 files) all
pass.

### Noteworthy Events

- The plan asserted that `ProposalStatusSchema` in `src/lib/schemas.ts`
  already accepts `'skipped'`. It does not (current enum is `['pending',
  'done', 'failed']`). The implementation still meets every acceptance
  criterion: cursory session logs land on disk with `proposal_status:
  skipped` (verified via `gray-matter` in the new tests) and both
  `listPendingSessions` and `countPendingSessions` correctly exclude them.
  The exclusion happens because `SessionLogFrontmatterSchema.safeParse`
  rejects the unknown enum value and the consumer `continue`s. That is
  fragile: any future strict parse of a cursory log will throw. Recorded
  as a follow-up.
- The pre-existing "writes a session log with pending frontmatter on a
  fresh capture" test was overridden to use a >500-char agent turn so the
  default-fixture intent survives the new filter. Test fixture-only
  change; no production behaviour reinterpretation.
- The feature branch was created off `main` after switching from the
  prior in-progress branch (working tree was clean at the start of this
  run).

### Necessary follow-ups

- Add `'skipped'` to `ProposalStatusSchema` in `src/lib/schemas.ts` so
  cursory frontmatter round-trips through the schema cleanly. After that,
  update `listPendingSessions` (`src/lib/curate.ts:99`) and
  `countPendingSessions` (`src/lib/session-start.ts:153`) to filter on
  `proposal_status === 'pending'` (the plan's stated intent), not
  `!== 'done'`. This is the only change needed to make the cursory path
  robust to a strict parse.
- Manually exercise the two end-to-end validation steps (the plan's Self
  Validation 9 and 10): one Claude Code session with a single short user
  turn ("hi") to confirm the captured log carries `proposal_status:
  skipped` and `proposal_error: cursory_session`, and one session using
  `/self-review-apply <path>.xml` to confirm the captured log body
  carries the new `[USER /self-review-apply ...]:` and
  `[AGENT NARRATION OF SELF-REVIEW ...]:` markers.
