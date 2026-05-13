---
id: 3
group: "skill-template"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - markdown
---

# Rewrite the `kb-curate` SKILL.md to call the CLI and tighten allowed-tools

## Objective

Replace the manual file-mutation steps in `src/templates-source/claude/skills/kb-curate/SKILL.md` with a CLI-driven loop, and remove the now-unnecessary `Edit`, `Write`, and `Bash(rm:*)` permissions.

## Skills Required

- `markdown`: rewrite the skill template's frontmatter `allowed-tools` line and step 3 prose.

## Acceptance Criteria

- [ ] `allowed-tools` is exactly: `Bash(ai-knowledge-base curate:*), Bash(ai-knowledge-base conflict:*), Read` (in that order, comma-separated, matching the existing line style).
- [ ] Step 3 (`### 3. Resolve pending conflicts`) is rewritten so the LLM:
  - Runs `ai-knowledge-base conflict list` and parses its JSON output.
  - For each conflict: reads the existing node referenced by `target_node_id` (the only remaining `Read`-shaped step), presents both sides plus the curator's `rationale` to the user, and asks the user to choose `Replace`, `Reject`, or defer.
  - On `Replace` or `Reject`: runs `ai-knowledge-base conflict resolve <id> --action replace` or `--action reject` and reports the CLI's one-line result back to the user. The skill does not touch `pending-conflicts.json`, does not run `rm`, and does not `Write` node files.
  - On defer: leaves the entry alone and tells the user `ai-knowledge-base status` will keep tracking it.
- [ ] The "never overwrite the whole file with a stale snapshot" sentence is removed (the LLM no longer touches the JSON file).
- [ ] The "If `pending-conflicts.json` is missing or has `conflicts: []`, skip step 3" constraint is rewritten to talk about empty CLI output instead of the file directly (e.g., "If `ai-knowledge-base conflict list` prints `[]`, skip step 3").
- [ ] Steps 1, 2, and 4 (`Run the curator`, `Report the summary`, `Hand off`) and the remaining `## Constraints` bullets stay intact except where the bullet above requires editing.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/templates-source/claude/skills/kb-curate/SKILL.md`.
- The frontmatter `name` and `description` fields are unchanged.
- The CLI command names used in the rewritten prose must exactly match what Task 2 wires up (`ai-knowledge-base conflict list`, `ai-knowledge-base conflict resolve <id> --action replace|reject`).

## Input Dependencies

None (this can be written in parallel with Tasks 1–2; just keep the command names consistent with the plan).

## Output Artifacts

- Updated `src/templates-source/claude/skills/kb-curate/SKILL.md`.

## Implementation Notes

<details>
<summary>What the rewritten step 3 should look like</summary>

```markdown
### 3. Resolve pending conflicts

Run `ai-knowledge-base conflict list`. The command prints the pending conflicts array as JSON on stdout. If the output is `[]`, skip this section.

For every entry in the parsed array:

1. Read the existing node referenced by `target_node_id` (under `nodes/<kind>/<target_node_id>.md`).
2. Present both sides to the user concisely:
   - **Existing node**: title, summary, the relevant body excerpt.
   - **Proposed contradiction**: `proposed_node.title`, `summary`, `body`, plus the curator's `rationale`.
3. Ask the user to choose exactly one of two actions:
   - **Replace**: run `ai-knowledge-base conflict resolve <id> --action replace`. The CLI deletes the existing node, writes the proposed node, removes the entry from `pending-conflicts.json`, and regenerates `INDEX.md`/`GRAPH.md`. Report the CLI's one-line result to the user.
   - **Reject**: run `ai-knowledge-base conflict resolve <id> --action reject`. The CLI removes the entry and regenerates `INDEX.md`/`GRAPH.md`; the existing node stays as is.

If the user defers a conflict ("I'll think about it"), leave the entry alone. `ai-knowledge-base status` continues to report the count, so it won't be forgotten.
```

The "Replace" bullet in the prior version mentioned `rm` and `Write` explicitly; remove every such reference. The skill must no longer claim it edits or writes any file other than reading the target node.

Update the `## Constraints` bullet that says "If `pending-conflicts.json` is missing or has `conflicts: []`, there's nothing to resolve; skip step 3." to "If `ai-knowledge-base conflict list` prints `[]`, there's nothing to resolve; skip step 3." (or fold the sentence into step 3 if you prefer; the user-facing meaning must remain).

</details>
