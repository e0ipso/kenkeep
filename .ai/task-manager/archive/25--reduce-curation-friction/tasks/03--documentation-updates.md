---
id: 3
group: "documentation"
dependencies: [1, 2]
status: "completed"
created: 2026-05-21
skills:
  - documentation
---
# Update daily-use docs for new nudge, fast path, and y/n/s/k conflict UX

## Objective
Update user-facing documentation so contributors discover the new curation UX: louder SessionStart nudge, fast-path zero-conflict `/kb-curate`, and the `y`/`n`/`s`/`k` conflict-resolution shortcuts. Call out the break with the old Accept/Reject/Keep three-way prompt.

## Skills Required
- `documentation`: clear, accurate prose; consistent with the rest of `docs/`.

## Acceptance Criteria
- [ ] `docs/daily-use.md` updated to describe:
  - The new soft-vs-loud SessionStart nudge and what triggers each.
  - The fast-path one-line exit when no conflicts are pending.
  - The `y`/`n`/`s`/`k` reply shortcuts with one-sentence definitions each, and a note that empty reply takes the highlighted default.
  - A "Breaking change" callout that the previous Accept / Reject / Keep three-way free-form prompt has been replaced.
- [ ] `docs/how-it-works.md` reviewed; if it describes the old three-way prompt, update to match. If it does not mention the prompt, no change needed — explicitly state "no change required" in the task's completion note.
- [ ] No edits to `AGENTS.md` (per plan's documentation section).
- [ ] No edits to `README.md` (per plan's documentation section).
- [ ] Markdown lint / prettier (whatever the project runs) passes on changed files.

## Technical Requirements
- Files to edit (potentially):
  - `/workspace/docs/daily-use.md` — definite edit.
  - `/workspace/docs/how-it-works.md` — conditional edit.
- Must be consistent with the SKILL.md wording from Task 2 so users see the same vocabulary across the skill output and the docs.

## Input Dependencies
- Task 1 — final shape of the nudge (soft vs loud trigger thresholds and the exact heading literal).
- Task 2 — final wording of the y/n/s/k contract and the fast-path summary line.

## Output Artifacts
- Modified `docs/daily-use.md`
- Possibly modified `docs/how-it-works.md`

## Implementation Notes

<details>

**1. Read first, edit second.** Before drafting, read the current `docs/daily-use.md` and `docs/how-it-works.md` in full. The existing tone, heading level, and example style must carry over.

**2. Vocabulary alignment.** Quote the fast-path summary line verbatim from the SKILL.md so a user grep'ing for the exact string finds both. Same for the loud-nudge heading literal.

**3. Breaking change callout format.** Match whatever convention the project already uses in docs (look for prior `> **Note**` or `> **Breaking**` blocks). If none exists, use a short admonition near the conflict-resolution section header.

**4. Verification.** After editing, run:
```
npm run lint  # or whatever covers markdown
```
Open the affected files in a previewer if available; otherwise re-read your edits cold to make sure the change reads naturally.

**5. how-it-works.md decision.** Open the file, search for "Accept", "Reject", "Keep", or "three-way". If any of those exist in the context of conflict resolution, update them. If they do not, write one line in the task's completion comment explaining the file was reviewed and required no change.

</details>
