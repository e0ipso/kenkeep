---
id: 7
group: "documentation"
dependencies: [1, 2, 3, 4, 5, 6]
status: "completed"
created: 2026-05-13
skills:
  - documentation
---
# Update docs, prompts, and CHANGELOG to reflect deletions

## Objective
Strip references to the removed code paths from project docs, prompt files, and `.claude/skills/kb-*` READMEs. Add a CHANGELOG entry for plan 10.

## Skills Required
- documentation: edit markdown docs and the changelog

## Acceptance Criteria
- [ ] `AGENTS.md` (or `CLAUDE.md` at repo root, whichever is present) no longer references the dedup cache, the `.queue.json` queue file, retry rotation, `shortSessionId`, or the prompt fallback. If those sections are now empty, the headings are removed too.
- [ ] Prompt template files (`bootstrap-incremental`, `curator`, `proposal-extract` — verify paths) have any inline comments about "fallback" / "if placeholder missing" removed.
- [ ] `.claude/skills/kb-*` READMEs no longer mention `.queue.json` or `.dedup-cache.json`.
- [ ] `CHANGELOG.md` gains a new entry summarising the seven deletions (items 12, 18, 23, 24, 28, 29, 33). Follow the existing changelog format used by recent commits.
- [ ] No grep hits remain for the removed symbols: `rg -n "dedup-cache|DedupCacheFileSchema|QueueFileSchema|QueueEntrySchema|appendToQueue|hasQueueEntry|removeFromQueueHead|bumpAndRotate|extractJsonBlock|shortSessionId|buildParseFailureMessage" .` returns zero hits across the whole repo (excluding the changelog entry itself, the plan 10 directory, and `dist/` if present).
- [ ] Net `git diff --stat main` shows at least 100 fewer source lines (success criterion 9 from the plan).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Markdown editing only; no code changes.
- Knowledge of the project's CHANGELOG style (see `CHANGELOG.md` recent entries; this repo uses Conventional Commits but the changelog format is its own).

## Input Dependencies
- All prior tasks (1-6) must be complete; the docs describe the new state.

## Output Artifacts
- Edited `AGENTS.md` / `CLAUDE.md`.
- Edited prompt template files.
- Edited `.claude/skills/kb-*` READMEs.
- New `CHANGELOG.md` entry.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Run the no-hits grep listed in Acceptance Criteria. Confirm any remaining matches are inside docs only.
2. Open `AGENTS.md` (and `CLAUDE.md` at the root, if present). Search for each removed concept: dedup cache, queue, retry rotation, `shortSessionId`, prompt fallback. Delete or rewrite the surrounding paragraph so it describes the current design only. Per the user's standing rule, do not write retrospective framing ("previously the system did X") — just describe how it works now. If a section becomes empty, remove the heading.
3. Open the three prompt templates (search `src/prompts/` or wherever they live). Remove inline comments about fallback behaviour.
4. Open `.claude/skills/kb-bootstrap/`, `.claude/skills/kb-curate/`, and `.claude/skills/kb-add/` README files (or wherever the kb skills live). Remove references to `.queue.json` and `.dedup-cache.json`.
5. Add a `CHANGELOG.md` entry. Match the format of the most recent entry (look at `git log --oneline -20` plus `head` of CHANGELOG.md to confirm). Summarise the seven deletions in one section. Do not write "BREAKING:" framing — per the user's no-retrospective rule, describe the new behaviour.
6. Re-run the no-hits grep across the repo to confirm only the changelog entry mentions the removed names.
7. Run `git diff --stat main` and confirm net deletion >=100 lines.

</details>
