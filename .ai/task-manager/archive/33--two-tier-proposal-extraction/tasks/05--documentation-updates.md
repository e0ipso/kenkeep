---
id: 5
group: "documentation"
dependencies: [1, 2, 3]
status: "completed"
created: "2026-05-24"
skills: ["markdown"]
---
# Update AGENTS.md to document two-tier extraction flow

## Objective
Update the "Capture and curation pipeline" section in `AGENTS.md` to document the two-tier proposal extraction architecture, so contributors understand why Claude sessions defer to `/kb-curate` and why non-Claude hooks check CLI availability.

## Skills Required
Markdown — documentation updates only.

## Acceptance Criteria
- [ ] `AGENTS.md` "Capture and curation pipeline" section (around line 87) documents the two-tier extraction flow
- [ ] Documents that Claude sessions defer extraction to `/kb-curate` (Tier 1 gate)
- [ ] Documents that non-Claude hooks check CLI availability before running (Tier 1 gate)
- [ ] Documents that `/kb-curate` drains remaining pending logs inline before curation (Tier 2)
- [ ] Documents that there is no entry cap on the async hook drain (drains all pending)
- [ ] Existing bullet points in the section are preserved or updated (not deleted)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The section starts at line 87 of `AGENTS.md` with heading `### Capture and curation pipeline`.
- Preserve all existing bullet points — add new ones or modify existing ones to reflect the two-tier flow.
- Keep the same style: short bullet points with links to KB nodes where applicable.

## Input Dependencies
- Tasks 1, 2, and 3 must be complete so the documentation accurately reflects the final behavior.

## Output Artifacts
- Modified: `AGENTS.md`

## Implementation Notes

<details>

### Changes to make

In the `### Capture and curation pipeline` section (line 87 of `AGENTS.md`), add or modify bullet points to cover:

1. **Two-tier extraction flow** (new bullet, add near the top of the section after the recursion guard bullet):
   > - **Proposal extraction is two-tier.** Tier 1: async `SessionStart` hooks drain pending session logs via the headless CLI — but only when eligible (non-Claude harness + CLI binary on PATH). Claude sessions early-return because spawning a headless lane is wasteful; harnesses without their CLI installed early-return gracefully. Tier 2: `/kb-curate` drains any remaining `pending` logs inline before curation (Step 0), ensuring every user has a reliable extraction path.

2. **No entry cap** (modify or add near the launchers/primitives bullet):
   > - The async proposal-drain hook drains **all** pending session logs in one pass (no entry cap). The `maxEntries` parameter exists in the API for explicit capping but defaults to no limit.

3. **`session-log update-proposals` primitive** (add to the launchers/primitives bullet or as a new bullet):
   > - The `session-log update-proposals` CLI primitive writes validated proposal JSON into session log frontmatter. Used by the `/kb-curate` inline extraction step; deterministic, no LLM.

### Style guidance

Keep bullets concise. Link to KB nodes if relevant ones exist. Don't duplicate information already covered by existing bullets (e.g., the recursion guard bullet at line 89 already explains `KB_BUILDER_INTERNAL`).

</details>
