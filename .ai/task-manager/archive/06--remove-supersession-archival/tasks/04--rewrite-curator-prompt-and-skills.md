---
id: 4
group: "prompts-and-skills"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - prompt-engineering
---
# Rewrite curator prompt and KB skill templates for binary replace/reject conflict model

## Objective

Update the curator prompt (both the source under `src/templates-source/prompts/curator.md` and the installed project-level copy `.ai/knowledge-base/.config/prompts/curator.md`) and the three KB skill templates (`kb-curate`, `kb-add`, `kb-bootstrap` `SKILL.md` files under `src/templates-source/claude/skills/`) so that:

1. The curator's `## Action: contradict` section frames the resolution as a binary replace-vs-reject choice and removes the supersession narrative.
2. The documented `proposed_node` field list drops `supersedes`, `valid_from`, `valid_until`, `superseded_by`.
3. The `/kb-curate` skill enumerates exactly two resolution actions: Replace (delete the existing node file at `nodes/<kind>/<id>.md`, then write the proposed content; the proposed node may reuse the deleted id) and Reject (do nothing). The third "keep both" option is removed. No instruction to stamp `supersedes`, `valid_from`, or `updated`.
4. The frontmatter template emitted by `/kb-add` and `/kb-bootstrap` agents lists only surviving fields.

## Skills Required

- prompt-engineering: rewrite LLM instruction text and skill templates with strict style rules (no em-dashes or hyphen-as-dash separators, no retrospective framing).

## Acceptance Criteria

- [ ] `src/templates-source/prompts/curator.md` `## Action: contradict` section describes replace vs reject only, with no mention of supersession or "keep both".
- [ ] The same prompt's documented `proposed_node` field list contains none of `supersedes`, `valid_from`, `valid_until`, `superseded_by`.
- [ ] `.ai/knowledge-base/.config/prompts/curator.md` mirrors the changes in the source prompt exactly.
- [ ] The `Version:` header in both curator prompts is bumped (the prompt behavior changed; per project convention bump version on behavior change).
- [ ] `src/templates-source/claude/skills/kb-curate/SKILL.md` enumerates exactly two resolution actions (Replace, Reject); a grep for `supersede|keep both|valid_from|valid_until|superseded_by|updated:` returns empty.
- [ ] `src/templates-source/claude/skills/kb-add/SKILL.md` and `src/templates-source/claude/skills/kb-bootstrap/SKILL.md` frontmatter templates list none of the five removed fields.
- [ ] No em-dash (`—`), en-dash (`–`), or ` - ` separator appears in new instructional prose (matches inside transcript-style example bodies that quote user or agent content verbatim are acceptable).
- [ ] No retrospective framing ("previously", "we used to", "earlier this prompt did") appears in any edited prose.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files:
  - `src/templates-source/prompts/curator.md`
  - `.ai/knowledge-base/.config/prompts/curator.md`
  - `src/templates-source/claude/skills/kb-curate/SKILL.md`
  - `src/templates-source/claude/skills/kb-add/SKILL.md`
  - `src/templates-source/claude/skills/kb-bootstrap/SKILL.md`
- The two curator prompts must remain byte-for-byte equivalent after the edits (they are the same content shipped in two locations).
- The `Replace` action wording must make explicit that the existing node file is deleted before the new one is written, and that the new node may reuse the deleted id.

## Input Dependencies

- Task 1 completed (the documented `proposed_node` field list and the schema must agree).

## Output Artifacts

- Updated curator prompt (source + project copy) with a binary `contradict` action and slimmer `proposed_node` documentation.
- Updated `kb-curate`, `kb-add`, `kb-bootstrap` `SKILL.md` files.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Read both curator.md files end-to-end first.** Identify the `## Action: contradict` section and the `proposed_node` documentation block. Note the current `Version:` header value.

2. **Rewrite `## Action: contradict`:**
   - Open with a single sentence stating the curator emits `contradict` when a proposed claim conflicts with an existing node, and the user later resolves it offline as either Replace or Reject.
   - Remove every paragraph that discusses supersession, valid windows, "keep both", lineage, or "marking the old node as replaced". These concepts no longer exist.
   - Keep guidance on how to choose `target_node_id` and how to phrase the conflict summary; this is still useful.

3. **Trim the `proposed_node` field documentation:**
   - List only the surviving fields. Mirror the schema from task 1 exactly: `id`, `title`, `kind`, `tags`, `derived_from`, `relates_to`, `depends_on`, `confidence`, `summary`, plus body sections.
   - Delete bullet points for `supersedes`, `valid_from`, `valid_until`, `superseded_by`.

4. **Mirror the edits in `.ai/knowledge-base/.config/prompts/curator.md`** by copy. Run `diff src/templates-source/prompts/curator.md .ai/knowledge-base/.config/prompts/curator.md` to confirm they match.

5. **Bump the `Version:` header in both files.** The prompt behavior changed (the action menu shrank, the schema shrank), so the version bump is required.

6. **`kb-curate/SKILL.md` rewrite.** Locate the resolution-options section (likely a numbered or bulleted list of three actions). Rewrite to exactly two:
   - **Replace**: `rm nodes/<kind>/<id>.md`, then write the proposed node file. The proposed node may reuse the same id (the previous file is gone) or introduce a fresh id. After writing, the human reviewer accepts by `git commit` or rejects by `git restore`.
   - **Reject**: take no action; the existing node stays as is. Delete the pending conflict entry from `.ai/knowledge-base/.state/pending-conflicts.json` after the user confirms rejection.
   Remove every instruction to stamp `supersedes`, `valid_from`, `valid_until`, `superseded_by`, or `updated`. If the SKILL.md previously documented a "supersede" or "keep both" option with its own subsection, delete those subsections.

7. **`kb-add/SKILL.md` and `kb-bootstrap/SKILL.md` frontmatter templates.** Each file shows the agent the exact YAML frontmatter to emit for a new node. Delete the five removed fields from those templates. Keep `id`, `title`, `kind`, `tags`, `derived_from`, `confidence`, `relates_to`, `depends_on`, `summary` (and any other surviving field).

8. **Style sweep.** For every paragraph you wrote or edited:
   - Replace any ` - `, `—`, or `–` used as a separator with commas, colons, or parentheses.
   - Rewrite any sentence that used "previously", "we used to", "this prompt earlier" in present tense.
   Verification grep on every edited file: `grep -nE "( - |—|–)" <file>` should return only hits inside fenced code blocks, YAML examples, or quoted transcript content.

9. **Final cross-check.** Run:
   ```
   grep -nE "supersede|keep both|valid_from|valid_until|superseded_by|updated:" \
     src/templates-source/prompts/curator.md \
     .ai/knowledge-base/.config/prompts/curator.md \
     src/templates-source/claude/skills/kb-curate/SKILL.md \
     src/templates-source/claude/skills/kb-add/SKILL.md \
     src/templates-source/claude/skills/kb-bootstrap/SKILL.md
   ```
   Expect zero hits.

</details>
