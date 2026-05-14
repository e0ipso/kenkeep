---
id: 3
group: "prompts"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - prompt-engineering
---

# Trim proposal-extract prompt: drop cursory shape, collapse self-review-apply section, bump Version

## Objective
Update `src/templates-source/prompts/proposal-extract.md` so the prompt no longer carries the two preprocessing concerns the wrapper now owns: the cursory non-productive shape (now handled by `captureSession`'s threshold filter) and the filename-variance caveat for `/self-review-apply` (now handled by the deterministic tag inserted by `renderRoleTagged`). Bump `Version: 2` → `Version: 3` per `practice-prompt-versioning`. Sweep every "five" count and downstream reference to the cursory shape so the prompt is internally coherent with four non-productive shapes.

## Skills Required
- prompt-engineering: rewrite prompt sections to keep gate logic, ownership boundary, and inline examples consistent after the cut.

## Acceptance Criteria
- [ ] Header `Version:` reads `3`.
- [ ] The "five non-productive shapes" sentence at line 20 reads "Four non-productive shapes apply, each a whole-session reject: abandoned, exploratory, unrelated, and meta-only."
- [ ] The cursory bullet (line 24 in the current text) is removed; the four remaining bullets (abandoned, exploratory, unrelated, meta-only) are kept verbatim.
- [ ] The gate-decision paragraph at line 28 ("If any of the five shapes...") and the confidence-bias rule and scope-clarification paragraphs are reread and rewritten so no occurrence of "five" remains; replace with "four" or "any of the four" as appropriate. The reasoning of each paragraph must still parse.
- [ ] Lines 100-107 (the `#### Self-review-apply turns` section) collapse to a single short paragraph keyed off the new tag: "When you see a `[USER /self-review-apply ...]:` tag, treat each narrated change in the following agent turn as a candidate corrective signal. Apply both the corrective-pattern rule and the task-specific filter to each narrated change independently."
- [ ] The inline example at lines 217-256 (`### Inline example: a self-review-apply turn`) is kept but updated: the input transcript starts with `[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml` and the next line begins `[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]: I worked through the review comments...`. The "treat any `.xml` path as a valid self-review-apply target" aside is removed.
- [ ] `rg -n "five non-productive|five whole-session|five shapes" src/templates-source/prompts/proposal-extract.md` returns zero hits.
- [ ] `rg -n "cursory|CURSORY" src/templates-source/prompts/proposal-extract.md` returns zero hits.
- [ ] `rg -n "^  Version: 3" src/templates-source/prompts/proposal-extract.md` (or `rg -n "Version: 3"`) returns one hit at the header comment.
- [ ] `rg -n "AGENTS.md|kb-.*README" .` does not surface any reference to "five non-productive shapes" or to the cursory shape; if it does, those documents are updated to read "four" (or the cursory mention is removed) as part of this task.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File: `src/templates-source/prompts/proposal-extract.md`.
- Reference checks: `AGENTS.md`, `.claude/skills/kb-*/` README files (only if they mention five shapes or the cursory shape).
- The prompt is shipped as a template under `templates-source/`; do not edit any compiled or generated copy.

## Input Dependencies
None. The prompt edit is independent of the implementation tasks (the new role markers are emitted by the renderer at runtime; the prompt just describes their format).

## Output Artifacts
- Rewritten `proposal-extract.md` with `Version: 3`, four non-productive shapes, and a collapsed self-review-apply section.
- Any doc-level references to "five non-productive shapes" updated to "four".

## Implementation Notes

<details>

### Edits, in order

1. **Version bump (line ~4).** Change `Version: 2` to `Version: 3` in the leading HTML comment.

2. **Session-disposition gate (line 20).** Replace `Five non-productive shapes apply, each a whole-session reject: abandoned, exploratory, cursory, unrelated, and meta-only.` with `Four non-productive shapes apply, each a whole-session reject: abandoned, exploratory, unrelated, and meta-only.`

3. **Bullet list (line 24).** Delete the entire `- **Cursory / single-turn / trivial.** ...` bullet. Leave the four other bullets unchanged.

4. **Gate decision (line 28).** Change `If any of the five shapes applies...` to `If any of the four shapes applies...`.

5. **Confidence-bias rule and scope clarification (lines 30, 32).** Reread both paragraphs; replace any remaining `five` with `four`. The wording around "phantom convention" and "session disposition, not candidate quality" stays.

6. **Self-review-apply section (lines 100-107).** Delete the existing two-bullet block entirely. Replace with:

```
#### Self-review-apply turns

When you see a `[USER /self-review-apply ...]:` tag, treat each narrated change in the following agent turn (which is tagged `[AGENT NARRATION OF SELF-REVIEW ...]:`) as a candidate corrective signal. Apply both the corrective-pattern rule and the task-specific filter to each narrated change independently.
```

7. **Inline example for self-review-apply (lines 217-256).** Keep the example structure (it still teaches kept-vs-dropped judgement). Update the input transcript so the role markers carry the new tags:

```
[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml
[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]: I worked through the review comments in feedback/round-2.xml and applied two changes.

First, the reviewer flagged that I had used a single-letter loop variable `i` inside `src/lib/feed-builder.ts`. The note said loop variables in this codebase always use descriptive names so the intent is readable at a glance. I renamed `i` to `cardIndex`.

Second, the reviewer pointed out a typo in the JSDoc for `assembleHeroCard`: "recieves" should be "receives". I fixed the typo in that one docstring.
```

Also remove the introductory sentence "Note that the XML filename here is not `review.xml`; treat any `.xml` path as a valid self-review-apply target." That caveat existed to defend against the variable filename, which the tag now subsumes. Replace it with a single sentence that simply notes the tag, for example: "Note the role markers: the user turn carries the `[USER /self-review-apply ...]:` tag and the agent narration carries `[AGENT NARRATION OF SELF-REVIEW ...]:`. The example below uses those tags directly."

The "Correct output" JSON block and the "Commentary on what was dropped" closing paragraph stay unchanged; only the input transcript and the surrounding aside are edited.

### Sanity sweep

Before finalising, run the regex checks from the acceptance criteria:

```bash
rg -n "five non-productive|five whole-session|five shapes" src/templates-source/prompts/proposal-extract.md
rg -n "cursory|CURSORY" src/templates-source/prompts/proposal-extract.md
rg -n "Version: 3" src/templates-source/prompts/proposal-extract.md
```

Expected: first two return zero hits; the third returns exactly one hit at the header.

Also grep the repo for any external doc that names the five shapes or the cursory shape:

```bash
rg -n "five non-productive|cursory.*single-turn|single-turn.*cursory" .
```

If `AGENTS.md` or any `.claude/skills/kb-*/` README mentions either, update the text to read "four" (or drop the cursory mention) as part of this task. If there are no such hits, skip the doc update.

### What to NOT change

- The "End-state framing rule", "Practice nodes", "Map nodes", "What you are NOT looking for", "Task-specific scope filter", "Transition narratives", "Ownership boundary", "Output schema", and "Final instructions" sections remain untouched.
- The first inline example (the bravo_pii.cache one) is unchanged.
- The placeholder `[TRANSCRIPT PLACEHOLDER - substituted at runtime]` stays as is.

</details>
