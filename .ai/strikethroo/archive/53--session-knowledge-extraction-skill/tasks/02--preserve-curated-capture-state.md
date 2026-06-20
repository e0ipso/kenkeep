---
id: 2
group: "session-knowledge-extraction"
dependencies: []
status: "completed"
created: 2026-06-20
skills:
  - typescript
  - capture-pipeline
complexity_score: 6
complexity_notes: "Changes shared capture rewrite behavior while preserving unprocessed-session semantics, terminal proposal metadata, curation stamps, and usage tracking."
---
# Preserve curated session state during capture refresh

## Objective
Update capture's same-session rewrite path so a later Stop/SessionEnd/PreCompact capture does not reopen a session log already processed by live extraction and `curate-dedup`.

## Skills Required
- `typescript` - read and merge existing session-log frontmatter safely before rendering the refreshed log.
- `capture-pipeline` - preserve current capture behavior for unprocessed and cursory sessions while carrying forward curation stamps only when appropriate.

## Acceptance Criteria
- [ ] When capture rewrites an existing log whose frontmatter has `curator_processed_at`, the refreshed log preserves `curator_processed_at`, `curator_run_id`, `proposal_status`, `proposal_completed_at`, `proposal_error`, `proposal_log`, `proposals`, and any existing `topics` array if present.
- [ ] Unprocessed existing logs still refresh as they do today, including pending/skipped proposal status behavior for ordinary and cursory sessions.
- [ ] The capture hook UUID-v4 validation boundary is not weakened.
- [ ] Usage tracking remains best-effort and non-fatal after the capture write.
- [ ] Tests cover processed-log preservation and prove an unprocessed same-session rewrite is not accidentally treated as already curated.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files likely involved: `src/lib/capture.ts`, `src/lib/session-log.ts`, `src/lib/schemas.ts` if a frontmatter type/helper is needed, and capture-related tests.
- Use structured YAML/frontmatter parsing rather than ad hoc string slicing when carrying fields forward.
- The merge should be narrow: preserve only the terminal curation/proposal fields required by the plan when `curator_processed_at` is present.
- No session-log schema version bump is expected. `SessionLogFrontmatterSchema` is not strict today, so preserving `curator_processed_at` / `curator_run_id` does not require adding new required fields.

## Input Dependencies
None. This task can be developed in parallel with Task 1, but it should remain compatible with the staged logs Task 1 creates.

## Output Artifacts
- Capture rewrite logic that preserves already-curated session-log state.
- Regression tests for processed and unprocessed same-session captures.

## Implementation Notes
This is one of the two shared behavior changes outside the new live extraction path, alongside Task 6's opt-in `curate-dedup` session filter. Keep it additive and avoid changing how new captures or unprocessed rewrites are queued.

<details>
<summary>Detailed implementation guidance</summary>

1. Start from `captureSession` in `src/lib/capture.ts`. The current flow finds `existingFilename`, chooses the filename, renders a fresh log, and writes it.
2. Before rendering or immediately after choosing `existingFilename`, read existing frontmatter when a file is present. Parse it with the same YAML/frontmatter approach used elsewhere in the codebase.
3. If and only if `curator_processed_at` is set, carry forward:
   - `curator_processed_at`
   - `curator_run_id`
   - terminal proposal fields: `proposal_status`, `proposal_completed_at`, `proposal_error`, `proposal_log`, `proposals`
   - `topics` if present on an older or doc-described log
4. Keep the refreshed transcript body, `captured_at`, and `transcript_hash` from the current capture so the log remains a fresh representation of the latest transcript.
5. Verify that cursory-session logic still sets `proposal_status: skipped` only for unprocessed logs, not for logs already stamped by curation.
6. Add tests that create an existing log, run `captureSession`, and inspect the resulting frontmatter. Include one negative test where the existing log lacks `curator_processed_at`, and one test where the refreshed transcript is cursory but the existing curated proposal state remains `done`.

</details>
