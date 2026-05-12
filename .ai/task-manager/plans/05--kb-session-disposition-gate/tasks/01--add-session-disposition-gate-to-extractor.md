---
id: 1
group: "prompt-revisions"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - prompt-engineering
---
# Add session-disposition gate to proposal-extract.md

## Objective

Edit `src/templates-source/prompts/proposal-extract.md` to add a session-disposition gate near the top of the decision flow. The gate judges whether the session as a whole converged on durable knowledge; when the session reads as non-productive (one of five named shapes), the extractor emits an empty proposal and stops. The new subsection names all five shapes with concrete triggers, includes a confidence-bias rule favoring the empty proposal under ambiguity, and carries one inline worked example of a meta-only session that contains a rule-shaped mid-conversation statement.

## Skills Required

- prompt-engineering: extend an LLM instruction file with a new whole-session gate that sits alongside plan 03's existing per-candidate rules without contradicting them, and craft a worked example that inoculates against the meta-only false-positive vector.

## Acceptance Criteria

- [ ] A new "Session-disposition gate" subsection is placed before the existing "What you are looking for" detail sections, so it is the first question the extractor answers about the transcript.
- [ ] The gate defines session disposition as a whole-session property: did the conversation, taken as a whole, converge on durable knowledge worth recording.
- [ ] All five non-productive shapes are named explicitly with concrete transcript-text triggers each: abandoned/dead-end, exploratory/open-ended, cursory/single-turn/trivial, unrelated/off-project, meta-only.
- [ ] The meta-only shape is documented as a no-exception whole-session skip: when the session is meta-only, no candidates survive, regardless of whether a mid-conversation statement looks rule-shaped.
- [ ] A confidence-bias rule for the gate mirrors plan 03's: when the session's disposition is ambiguous, the extractor prefers the empty proposal.
- [ ] The gate's output is specified: when any of the five shapes applies, emit `{"practice": [], "map": []}` and stop.
- [ ] A scope-clarifying note distinguishes the gate (whole-session disposition) from plan 03's task-specific scope filter (per-rule generalization) and from the end-state framing rule (per-candidate wording). The three filters stack, not compete.
- [ ] One inline worked example shows a meta-only / plan-authoring conversation containing a mid-thread statement that looks rule-shaped (for example "we always want a CI gate before merging"); the expected output is `{"practice": [], "map": []}` and the commentary names the false-positive failure mode the example inoculates against.
- [ ] Plan 03's existing structure (end-state framing rule, corrective-pattern subsection, self-review-apply subsection, task-specific filter, ownership boundary) is preserved verbatim; the gate is added alongside, not in place of, those sections.
- [ ] The ownership boundary remains: practice from `[USER]:` turns only; map from either role.
- [ ] No em-dashes, en-dashes, or ` - ` separators are introduced into new instructional prose. Matches inside example transcripts that quote user or agent text verbatim are acceptable.
- [ ] No retrospective framing ("previously", "we used to", "earlier this prompt did") and no backwards-compat references are introduced.
- [ ] The `Version:` header is left untouched (no version bump).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Target file: `src/templates-source/prompts/proposal-extract.md` (248 lines at start).
- Vocabulary to be shared verbatim with the curator prompt: "session disposition", "non-productive", and the five shape names (abandoned, exploratory, cursory, unrelated, meta-only). Reviewers grep both files for these terms.
- Inline example must remain valid against `ProposalOutputSchema`. The empty proposal `{"practice": [], "map": []}` is already schema-valid and is the canonical "no signal" output the prompt documents; mirror that shape.

## Input Dependencies

None. The plan document and the existing `proposal-extract.md` are sufficient.

## Output Artifacts

- Updated `src/templates-source/prompts/proposal-extract.md` with the session-disposition gate subsection and one new inline worked example demonstrating the meta-only short-circuit.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Read the current file end-to-end** before editing. Pay particular attention to where plan 03's "end-state framing", "corrective-pattern", "self-review-apply", and "task-specific filter" subsections live, and to the position and shape of existing inline worked examples. The new gate goes *above* these per-candidate rules, because session disposition is judged before any candidate is considered.

2. **Find the insertion point.** The gate sits near the top of the decision flow, before "What you are looking for". Likely just after the prompt's opening framing (objective, role, input format) and before the existing per-candidate guidance. Match the heading depth of the sibling subsections it precedes.

3. **Write the gate subsection.** Suggested heading: "Session-disposition gate". Contents in order:
   - One paragraph defining session disposition: the question is whether the session, taken as a whole, converged on durable knowledge worth recording. The unit of judgment is the session, not the individual turn. Explicitly contrast with task-specific scope (per-rule generalization) and end-state framing (per-candidate wording); the three filters operate at different levels and stack.
   - Five bullet items, one per shape. For each, give a short definition then concrete transcript-text triggers:
     - **Abandoned / dead-end.** The user reverses an in-flight approach without committing to a replacement ("let's not do this", "never mind", "we'll come back to this", "let's defer this", "actually, don't bother"). The session ends with the reversal or with a tangent, not with a durable claim. Distinct from the corrective pattern in plan 03: a corrective pattern names a replacement rule ("don't do X, do Y"); abandonment names no replacement.
     - **Exploratory / open-ended.** Investigation that surveys options without selecting one ("what could we do about X?", "let me look at how this works", "I'm trying to understand Y"). Questions raised, hypotheses floated, no end-state claim committed to.
     - **Cursory / single-turn / trivial.** Very short or very shallow. Single-turn exchanges, status checks, formatting fixes, one-line questions, "is it running?" probes. No durable convention can have been established.
     - **Unrelated / off-project.** Not about this project. General programming help, work on a different repository, personal conversation, support questions that do not reference this project's modules, vocabulary, or conventions.
     - **Meta-only.** The session's visible work is planning, tasking, brainstorming, scoping, or architecture-sketching, without arriving at a durable end-state claim about the project itself. Plan or task documents under `.ai/task-manager` (or any equivalent location the session reveals) are the canonical case, but the category is broader: any conversation that talks *about* what to build rather than capturing how the project already is. State explicitly: the whole session is skipped, with no exception for imperative corrections that occur mid-conversation; consistency with the other four shapes wins over per-candidate salvage.
   - One sentence specifying the gate decision: if any of the five shapes applies to the session as a whole, emit `{"practice": [], "map": []}` and stop. Producing nothing is the correct output for a non-productive session, just as it is for a session with no teaching moments.
   - One sentence stating the confidence-bias rule for the gate: when the session's disposition is ambiguous (could be productive, could not), prefer the empty proposal. A phantom convention costs more to remove than a missed real one costs to leave on the table.
   - One short paragraph clarifying scope: the gate is about session disposition, not candidate quality. A productive session with low-quality candidates still passes the gate; the per-candidate filters then decide which candidates are kept. A non-productive session with apparently high-quality candidates fails the gate; no candidates survive.

4. **Inline worked example.** Add one new inline example block in the same visual style as existing examples in the file. Structure:
   - A short multi-turn transcript that reads unambiguously as a planning conversation (for example, the user and agent discussing a plan document under `.ai/task-manager`, drafting acceptance criteria or success criteria). Embed mid-thread a statement that *looks* like a project convention, for example a `[USER]:` line saying "we always want a CI gate before merging" or similar.
   - The expected JSON output: `{"practice": [], "map": []}`.
   - Commentary explaining the decision: the surrounding session is meta-only (its visible work is plan-authoring); the rule-shaped statement is plan-scoped, not project-wide; the conservative gate skips the whole session. Name the failure mode this example inoculates against: phantom conventions extracted from planning conversations.

5. **Preserve plan 03's existing structure.** Do not edit the end-state framing rule, the corrective-pattern subsection, the self-review-apply subsection, the task-specific filter, or any existing inline examples. The gate is additive. If the existing structure already has a scope or filter intro, place the gate above it; do not interleave.

6. **Preserve the ownership boundary** (practice from `[USER]:` only; map from either role). If the new gate text risks muddying this rule, add a one-line reminder; otherwise leave it as is.

7. **Prose conventions.** Re-read edits for:
   - Em-dashes (`—`), en-dashes (`–`), or ` - ` separators: replace with commas, colons, or parentheses. Forbidden in instructional prose per `practice-no-em-dashes-or-hyphen-as-dash-in-prose`. Matches inside transcript-quoted example lines are acceptable.
   - Retrospective framing in instructional prose ("the prompt used to", "previously", "earlier this version"): rewrite in present tense.
   - Backwards-compat language ("for now keep", "legacy support for"): remove.

8. **Do not bump `Version:`.** Leave the existing version header untouched, consistent with plan 03.

9. **Verification (local).** Before marking the task complete, run:
   ```
   grep -nE "session disposition|non-productive|abandoned|exploratory|cursory|unrelated|meta-only" src/templates-source/prompts/proposal-extract.md
   grep -nE " - |—|–" src/templates-source/prompts/proposal-extract.md
   ```
   The first grep should show hits for the term "session disposition", the modifier "non-productive", and each of the five shape names. The second should not show hits in newly written instructional prose; hits inside example transcripts are acceptable.

</details>
