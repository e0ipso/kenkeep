---
id: 3
group: "skill-prompts"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - prompt-engineering
  - markdown
---
# Rewrite `kb-curate` SKILL.md so each ≤10-session batch is drafted by one host sub-agent (parallel), aggregated, then run through `curate-dedup` once

## Objective

Modify `src/templates-source/skills/kb-curate/SKILL.md` so each ≤10-session batch from Step 2 is delegated to a host-native sub-agent whose result is a JSON array of curator actions written to `_logs/curator/<runId>__<batchN>.draft.json`. The collector turn concatenates every batch's actions into the single proposals tmpfile and runs `curate-dedup` exactly once across all batches — unchanged from today. Sequential inline fallback preserved.

## Skills Required

- `prompt-engineering` — vendor-neutral dispatch wording, same pattern as Task 2 but with batch (≤10 sessions) as the unit of parallelism rather than per-doc.
- `markdown` — structural edit that keeps Steps 1, 3–8 intact and reshapes Step 2.

## Acceptance Criteria

- [ ] `src/templates-source/skills/kb-curate/SKILL.md` keeps Steps 1, 3, 4, 5, 6, 7, 7a–7e, 8, and Constraints intact in intent. Only Step 2 ("Read sessions in batches of ≤10 and draft curator actions") gains the orchestrator/probe/dispatch/fallback structure.
- [ ] Step 2 explicitly instructs the LLM to:
    1. **Probe** for a native sub-agent / Task dispatch primitive on its tool surface (same intent-based phrasing as Task 2 — no harness names).
    2. **Parallel path**: partition the pending sessions (already sorted by `captured_at`) into batches of ≤10. For each batch, mkdir `.ai/knowledge-base/_logs/curator/` and dispatch a sub-agent whose instructions tell it to read the batch's session files, draft `CuratorAction` objects per the existing rules (add/modify/contradict/drop), write the action array as JSON to the predetermined absolute path `_logs/curator/<runId>__<batchN>.draft.json`, and return the path. Concurrency cap: ≤5 sub-agents per orchestrator turn (issue in waves if needed).
    3. **Collector turn**: read every batch's tmpfile, concatenate the action arrays into a single in-memory array, write it to `$PROPOSALS` (the existing mktemp variable used in Step 3). The rest of the skill is unchanged: Step 3 still mints the runId/proposals/survivors paths, Step 4 still calls `curate-dedup` exactly once across all proposals, etc.
    4. **Fallback path**: today's sequential inline drafting — preserved byte-equivalent.
- [ ] The prompt instructs the orchestrator to mint the `runId` BEFORE the dispatch (so the per-batch tmpfile names can include it) — i.e. move/reuse the `RUN_ID=$(uuidgen 2>/dev/null || date -u +"curate-%Y%m%dT%H%M%SZ")` line so it's available at the top of Step 2. Step 3 then uses the same `$RUN_ID`.
- [ ] The prompt emits one structured JSON line per batch to `_logs/curator/<runId>__<batchN>.jsonl` (orchestrator "issued"; collector "validated"/"invalid").
- [ ] On failed JSON validation of a batch's tmpfile (parse error, schema mismatch against `CuratorActionSchema` shape — i.e. unknown keys in `proposed_node`, missing required action fields), the prompt instructs the LLM to surface "batch N produced invalid output, skipped" to the user and continue with the remaining batches. The single `curate-dedup` call then runs on the surviving actions only — never a hard abort.
- [ ] Vendor-neutral phrasing: zero new occurrences of `Task`, `subagent_type`, `@`-mention, or any harness id in the new dispatch block.
- [ ] The probe + dispatch + fallback wording lives in one cohesive section.
- [ ] `<!-- Version: N -->` bumped past the current `2`.
- [ ] Net SKILL.md size growth under ~30%.
- [ ] `npm run build` succeeds.
- [ ] Per-harness regenerated copies under `.claude/skills/kb-curate/`, `.codex/skills/kb-curate/`, `.cursor/skills/kb-curate/`, `.opencode/skills/kb-curate/` are not hand-edited.

## Technical Requirements

- Canonical prompt path: `src/templates-source/skills/kb-curate/SKILL.md`.
- The `curate-dedup` invocation in Step 4 is unchanged — dedup still runs once across all batches' output. Only the drafting step parallelises.
- The `CuratorActionSchema` shape (`action`, `candidate_origin`, `target_node_id`, `proposed_node`, `rationale`, with `proposed_node` keys exactly `title|kind|tags|summary|body|confidence|relates_to`) is already documented in the existing Step 2 — preserve that documentation.

## Input Dependencies

None.

## Output Artifacts

- Updated `src/templates-source/skills/kb-curate/SKILL.md` with the per-batch sub-agent dispatch in Step 2.
- Bumped `<!-- Version: N -->` comment.

## Implementation Notes

<details>

### Re-using the Task 2 phrasing

The probe + fallback wording should be functionally identical across kb-bootstrap and kb-curate (and kb-add, Task 4). Aim for a copy-pasteable paragraph that only the per-skill specifics (unit of parallelism, instructions to the sub-agent, output schema) change around. This factoring is what keeps the ≤30% growth cap achievable.

### Sub-agent instruction body (one per batch)

The orchestrator passes each sub-agent something like:

> You are drafting curator actions for ONE batch of pending session logs.
> - The batch contains the session files at the following absolute paths: <list>.
> - For each session, the `proposals:` frontmatter block has `practice: [...]` and `map: [...]` arrays. For each candidate, decide an action: `add`, `modify`, `contradict`, or `drop` per the rules below (re-state the rules from Step 2's "Action rules" subsection here, or instruct the sub-agent to fetch them from the parent skill — vendor-neutral, but practically: inline them; harnesses do not all let sub-agents read the host's prompt).
> - Build the action objects per `CuratorActionSchema`. Use `candidate_origin = "<session_id>:<practice|map>:<index>"`.
> - Write the actions array as JSON to `<absolute predetermined path>`. The file must contain exactly the JSON array, nothing else.
> - Return the path on success.

Inlining the action rules into the sub-agent instructions is a real cost to the prompt — to stay under the ≤30% cap, the sub-agent instructions can reference "the action rules in §2 of the parent skill" by their existing headings (sub-agents on every harness can `Read` the local file at `.claude/skills/kb-curate/SKILL.md` / equivalent if needed; or the parent can pass the rules verbatim). The implementer should pick whichever approach keeps total file size in budget. Recommended: pass a concise restated rule set (one-line per action verb) and link to the full rule headings.

### Collector turn

Concrete shell after all sub-agents complete:

```bash
RUN_ID=...  # from earlier
PROPOSALS=$(mktemp -t kb-curate-proposals.XXXXXX.json)
node -e "
  const fs = require('fs'), path = require('path');
  const dir = '.ai/knowledge-base/_logs/curator';
  const files = fs.readdirSync(dir).filter(f => f.startsWith('${RUN_ID}__') && f.endsWith('.draft.json'));
  const all = [];
  for (const f of files) {
    try { const arr = JSON.parse(fs.readFileSync(path.join(dir, f),'utf8')); all.push(...arr); }
    catch (e) { process.stderr.write('batch ' + f + ' invalid: ' + e.message + '\n'); }
  }
  fs.writeFileSync(process.env.PROPOSALS, JSON.stringify(all));
" PROPOSALS=$PROPOSALS
```

…or any equivalent concatenation idiom. The SKILL.md should show the pattern but not over-prescribe the exact shell — the LLM can choose.

### Universal-prompt audit

```bash
grep -E "\b(claude|codex|cursor|opencode|Task|subagent_type)\b" src/templates-source/skills/kb-curate/SKILL.md
```

Same rule as Task 2: hits confined to the harness-resolver block and `--harness "$HARNESS"` invocations.

### Skill scope

`prompt-engineering` + `markdown`. Do not touch other SKILL.md files, harness adapters, or docs. No CLI change.

</details>
