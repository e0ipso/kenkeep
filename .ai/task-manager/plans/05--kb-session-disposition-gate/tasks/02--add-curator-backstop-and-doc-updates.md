---
id: 2
group: "prompt-revisions"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - prompt-engineering
---
# Add non-productive-provenance backstop to curator.md and align internals doc

## Objective

Edit `src/templates-source/prompts/curator.md` to add a new **drop** reason for candidates carrying non-productive provenance signals, with concrete candidate-visible cues (hedged wording, hypothetical entities, plan-scoped framing, no rationale plus low confidence). Then update `docs/internals/prompts.md` so its Proposal-prompt "What to skip" list mentions the five non-productive shapes and its Curator-prompt "Anti-patterns" list gains a bullet for non-productive provenance signatures. Vocabulary is shared verbatim with the extractor edit in task 1.

## Skills Required

- prompt-engineering: extend the curator's existing drop-reason list with a new bullet that the curator can apply from candidate framing alone (it does not see the transcript), and keep the internals doc in sync with the prompt changes.

## Acceptance Criteria

- [ ] `src/templates-source/prompts/curator.md` adds **non-productive provenance signals** to the existing **drop** action's reason list. The reason is additive, not a replacement for any existing drop reason.
- [ ] The new drop reason lists concrete candidate-visible signals:
  - Hedged or tentative wording in body or summary ("we might", "we could", "we were considering", "the idea is to", "potentially", "in principle").
  - References to hypothetical or unrealized entities ("the planned X", "the eventual Y", "once we add Z").
  - Plan-scoped or task-scoped framing ("for this plan, we will…", "the success criterion is…", "as part of this work, we should…").
  - No rationale plus low confidence: a `confidence: "low"` candidate with no "because…" / "since…" rationale and no concrete example.
- [ ] The drop guidance frames the rule as a weighted judgment: the curator weighs the signals together and drops when the combined provenance signature is consistent with a non-productive session. It is not an automatic drop on the strength of a single signal.
- [ ] The curator file uses the shared vocabulary "session disposition" and "non-productive" so a grep across both prompt files matches both files.
- [ ] No other curator action is modified. **add**, **modify**, **contradict** semantics remain as plan 03 left them. No new schema fields, no new actions.
- [ ] `docs/internals/prompts.md` Proposal-prompt subsection gains a bullet in its "What to skip" list naming non-productive sessions and the five shapes (abandoned, exploratory, cursory, unrelated, meta-only).
- [ ] `docs/internals/prompts.md` Curator-prompt subsection gains an "Anti-patterns" bullet for candidates with non-productive provenance signatures (hedged wording, hypothetical entities, plan-scoped framing, no-rationale plus low-confidence).
- [ ] No em-dashes, en-dashes, or ` - ` separators are introduced into new prose in either file. Verbatim quotes from prompt examples are acceptable.
- [ ] No retrospective framing and no backwards-compat references are introduced.
- [ ] No README updates and no AGENTS.md updates are made; the plan documents these are out of scope.
- [ ] The `Version:` header in `curator.md` is left untouched (no version bump).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Target files:
  - `src/templates-source/prompts/curator.md` (155 lines at start).
  - `docs/internals/prompts.md` (184 lines at start). The plan notes the Proposal-prompt "What to skip" list is around line 35 and the Curator-prompt "Anti-patterns" list is around line 118 (where plan 03 added the change-oriented bullet). These are guideposts; verify by reading the file.
- Shared vocabulary with the extractor (task 1): "session disposition", "non-productive", and the five shape names.
- The curator does not see the transcript. All signals listed must be detectable from a candidate's own body, summary, confidence, tags, or absence-of-rationale. Do not list signals that would require transcript access.

## Input Dependencies

None. The plan document, the existing `curator.md`, and `docs/internals/prompts.md` are sufficient. Task 1 is not a hard dependency because the curator edits are file-local and the doc edits reference the gate concepts that the plan already defines.

## Output Artifacts

- Updated `src/templates-source/prompts/curator.md` with one additional drop reason and shared vocabulary.
- Updated `docs/internals/prompts.md` with two narrow bullet additions (one in Proposal-prompt skip list, one in Curator-prompt anti-patterns list).

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Read `curator.md` end-to-end.** Locate the existing **drop** action and its enumerated reason list (the same list plan 03 extended with the change-oriented framing bullet). Match the existing bullet style.

2. **Add the new drop reason.** Append a bullet (or sub-bulleted block, whichever the existing list uses) titled something like "non-productive provenance signals". Body:
   - One sentence framing: the curator does not see the transcript, but a candidate that originates from an abandoned, exploratory, cursory, unrelated, or meta-only session often carries telltale framing the curator can read directly.
   - The four concrete signal categories listed in the acceptance criteria. Use the exact example phrasings from the plan ("we might", "the planned X", "for this plan, we will", "no rationale plus low confidence") so reviewers can grep for them.
   - One sentence on weighting: drop when the candidate's combined provenance signature is consistent with a non-productive session. Do not drop automatically on a single signal in isolation; weigh signals together with confidence and rationale presence.

3. **Share vocabulary with the extractor.** The terms "session disposition" and "non-productive" must appear in `curator.md` somewhere in the new drop-reason text. The five shape names should also appear (in the introductory sentence) so a reviewer grepping `proposal-extract.md` and `curator.md` together sees both files using the same vocabulary.

4. **Do not modify other curator actions.** The **add**, **modify**, and **contradict** action semantics from plan 03 stay verbatim. The schema reference (whatever fields the curator emits) stays untouched. No new actions, no new fields.

5. **Do not bump `Version:`.** Leave the curator's version header untouched, consistent with plan 03.

6. **Read `docs/internals/prompts.md` end-to-end** before editing. Identify the Proposal-prompt subsection's "What to skip" (or similarly named) list and the Curator-prompt subsection's "Anti-patterns" list. Verify their exact line positions; the plan's "~line 35" and "~line 118" are pointers, not guarantees.

7. **Update the Proposal-prompt skip list.** Add one bullet naming non-productive sessions and the five shapes. Suggested wording: "non-productive sessions (abandoned, exploratory, cursory, unrelated, meta-only) yield no proposals; the extractor short-circuits to `{"practice": [], "map": []}` when the session as a whole does not converge on durable knowledge". Match the surrounding bullet style.

8. **Update the Curator-prompt anti-patterns list.** Add one bullet for non-productive provenance signatures: candidates whose framing carries hedged wording, references to hypothetical entities, plan-scoped or task-scoped wording, or low-confidence-without-rationale are dropped. Match the surrounding bullet style.

9. **Prose conventions.** Re-read edits in both files for:
   - Em-dashes (`—`), en-dashes (`–`), or ` - ` separators: forbidden in instructional prose. Replace with commas, colons, or parentheses. Verbatim example phrases inside backticks are acceptable.
   - Retrospective framing ("previously", "the prompt used to"): rewrite in present tense.
   - Backwards-compat language: remove.

10. **Verification (local).** Before marking the task complete, run:
    ```
    grep -nE "non-productive|hedged|hypothetical|plan-scoped" src/templates-source/prompts/curator.md
    grep -nE "session disposition|non-productive" src/templates-source/prompts/proposal-extract.md src/templates-source/prompts/curator.md
    grep -nE "non-productive|abandoned|exploratory|cursory|unrelated|meta-only" docs/internals/prompts.md
    grep -nE " - |—|–" src/templates-source/prompts/curator.md docs/internals/prompts.md
    ```
    The first grep should show the new drop reason and at least three of the candidate-visible signals. The second should show both terms in both prompt files (the cross-file vocabulary alignment is the indicator the two layers are aware of each other). The third should show the new doc bullets. The fourth should not show new offenders in instructional prose.

</details>
