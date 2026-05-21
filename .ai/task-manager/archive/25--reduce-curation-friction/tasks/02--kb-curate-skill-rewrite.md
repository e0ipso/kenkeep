---
id: 2
group: "kb-curate-skill"
dependencies: []
status: "completed"
created: 2026-05-21
skills:
  - prompt-engineering
  - typescript
---
# Rewrite kb-curate SKILL.md: fast path + grouped y/n/s/k conflict resolution

## Objective
Rewrite both copies of the `kb-curate` SKILL.md (the live template and its source mirror) so that (a) the zero-conflict run exits with a single summary line, and (b) the conflict walkthrough groups conflicts by `target_node_id`, pre-selects a default from a documented heuristic, and accepts a single-character user reply (`y`/`n`/`s`/`k`). Also extend the conflict-file frontmatter writer so the SKILL.md heuristic has the data it needs.

## Skills Required
- `prompt-engineering`: SKILL.md is consumed by the LLM; instructions must be unambiguous and parseable.
- `typescript`: small change to `src/lib/curate.ts` to enrich conflict frontmatter, and a matching test update.

## Acceptance Criteria
- [ ] `templates/skills/kb-curate/SKILL.md` and `src/templates-source/skills/kb-curate/SKILL.md` are byte-identical (the project's mirror sync expects this; verify with `diff`).
- [ ] Section "2. Report the summary" / "3. Resolve pending conflicts" is restructured. The new flow:
  - Run curator (unchanged).
  - Read `CurateResult` output (curator prints JSON or human summary — match what the curator actually emits today, see `src/commands/curate.ts`).
  - **Fast-path guard**: if `conflicts === 0 AND failures.length === 0`, print one line: `Curated N nodes; M dropped; no conflicts. Review with: git diff .ai/knowledge-base/` and stop. Document this guard as the first sentence of the post-curator step so the LLM short-circuits before doing any other work.
  - Otherwise, run the headline summary AND walk conflicts.
- [ ] Conflict walkthrough section documents:
  - Sort pending conflict files by `(target_node_id, proposed_kind, detected_at)`. Conflicts with `target_node_id: null` group last.
  - For each group sharing a `target_node_id`, show the existing node ONCE and then walk each proposed contradiction within the group.
  - For each conflict, the LLM computes a default (`y` / `n` / `s`) using this heuristic, made explicit in the SKILL.md:
    - `< 5` lines differ between proposed body and existing body AND `proposed_confidence === 'high'` → default `y`.
    - `> 50%` of lines differ → default `n`.
    - Otherwise → default `s`.
  - The user reply contract: accept `y`/`Y`/`yes`, `n`/`N`/`no`, `s`/`S`/`skip`, `k`/`K`/`keep`, empty (= take default). Anything else → re-prompt with the same group and default highlighted.
  - Outcome mapping:
    - `y` → rewrite `nodes/<kind>/<target_node_id>.md` with the proposed body and frontmatter, instruct user to `git restore .ai/knowledge-base/conflicts/<id>.md`.
    - `n` → instruct user to `git restore .ai/knowledge-base/conflicts/<id>.md`. Node unchanged.
    - `s` → leave the conflict file alone. It re-surfaces on next pass.
    - `k` → instruct user to `git commit` the conflict file. Node unchanged. Document this as "preserve disagreement as a historical record — used rarely."
  - Final step: hand-off summary with `git diff` reminder (unchanged).
- [ ] `src/lib/curate.ts` `persistAction` `contradict` branch writes one additional frontmatter field: `proposed_confidence: proposedNode.confidence` (value will be `'low' | 'medium' | 'high'` per `ConfidenceSchema`). Back-compat is broken per the plan's clarification — no migration needed.
- [ ] `tests/lib/curate.test.ts` is updated where it asserts on conflict frontmatter to expect the new `proposed_confidence` field. Run `npx vitest run tests/lib/curate.test.ts` to verify.
- [ ] Existing harness-detection block at the top of SKILL.md is preserved verbatim (the `/tmp/kb-detect-harness.mjs` materialization). Do not touch it.
- [ ] `npx vitest run` passes for both `tests/lib/curate.test.ts` and any test that imports the SKILL.md source.
- [ ] `npm run lint` passes on `src/lib/curate.ts`.

## Technical Requirements
- Files:
  - `/workspace/templates/skills/kb-curate/SKILL.md`
  - `/workspace/src/templates-source/skills/kb-curate/SKILL.md`
  - `/workspace/src/lib/curate.ts` (one frontmatter field addition)
  - `/workspace/tests/lib/curate.test.ts` (update expected frontmatter)
- Conflict frontmatter is currently written in `src/lib/curate.ts:347-364`. New field goes alongside `proposed_kind` / `proposed_title`.
- The curator prints headline numbers — confirm exact wording in `src/commands/curate.ts` so the SKILL.md can reference field names the LLM will actually see.

## Input Dependencies
None. Independent of Task 1.

## Output Artifacts
- Two updated SKILL.md files (byte-identical).
- Modified `src/lib/curate.ts` with extended conflict frontmatter.
- Updated `tests/lib/curate.test.ts`.

## Implementation Notes

<details>

**1. Source of truth for the SKILL.md.** The mirror under `src/templates-source/skills/kb-curate/SKILL.md` is the *source*; the copy under `templates/skills/` is the published artifact. Edit the source first, then copy. The project may have a build step that syncs them — check `package.json` scripts (`prebuild`, `build`, or a `sync-templates` script). If a build step exists, run it; otherwise `cp` the file and confirm `diff` returns empty.

**2. Existing SKILL.md sections to keep.** The harness-detection bash block at the top (`if [ ! -f /tmp/kb-detect-harness.mjs ]; then ...`) is not changing. The "Constraints" trailer also stays — adjust only where it references "three-way prompt" to reference `y`/`n`/`s`/`k`.

**3. Writing the heuristic block.** Models follow explicit numbered procedures better than prose. Phrase the heuristic as:
```
To pick the default for a conflict, compute:
1. lines_changed = number of lines that differ between proposed body and existing node body.
2. total_lines = max(proposed body line count, existing body line count).
3. ratio = lines_changed / total_lines.

Default rule (apply in order, stop at first match):
- If lines_changed < 5 AND proposed_confidence == "high" → default y.
- If ratio > 0.5 → default n.
- Otherwise → default s.
```

**4. The reply-parsing block.** Phrase it as:
```
After presenting a conflict, ask the user with the default highlighted, e.g.:
"Accept this proposal? [Y/n/s/k] (default: Y)"

Parse the reply:
- Empty, "y", "Y", "yes" → take y.
- "n", "N", "no" → take n.
- "s", "S", "skip" → take s.
- "k", "K", "keep" → take k.
- Anything else → re-prompt the SAME conflict with the same default. Do not infer intent from prose like "yes please".
```
The "do not infer from prose" line is load-bearing — without it the model will sometimes accept "looks good" as `y` and the user has no warning when their judgment was misread.

**5. The grouping block.** Phrase it as a sort + group:
```
List pending conflict files (frontmatter status: pending). Sort by:
1. target_node_id (alphabetic, nulls last).
2. proposed_kind.
3. detected_at.

Then iterate. When two consecutive conflicts share target_node_id, show the existing node once at the top of the group, then walk each proposed contradiction within the group asking y/n/s/k per conflict.
```

**6. The fast-path guard.** This must be the first instruction the LLM reads after the curator returns. Phrase it as a guard clause:
```
After the curator returns, IF result.conflicts == 0 AND result.failures.length == 0, print exactly:

  Curated {nodes_written} nodes; {dropped} dropped; no conflicts. Review with: git diff .ai/knowledge-base/

Then stop. Skip every step below.
```

**7. `src/lib/curate.ts` change.** In the `contradict` branch (around line 347), add `proposed_confidence: proposedNode.confidence` to the frontmatter object. `proposedNode.confidence` is already on the schema (`src/lib/schemas.ts:93`).

**8. `tests/lib/curate.test.ts` change.** Search for tests that assert conflict frontmatter shape (grep for `'pending'` or `target_node_id` in the test file). Add the new `proposed_confidence` field to the expected object. If a test asserts exact deep-equality on the frontmatter, that's where the field needs to land.

**9. Verification.** After editing, run:
```
diff /workspace/templates/skills/kb-curate/SKILL.md /workspace/src/templates-source/skills/kb-curate/SKILL.md
npx vitest run tests/lib/curate.test.ts
npm run lint
```
All three must come back clean.

</details>
