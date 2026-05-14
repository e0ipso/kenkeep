---
id: 2
group: "kb-add-skill"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - prompt-engineering
---
# Replace kb-add SKILL.md body with CLI invocation

## Objective
Stop the kb-add skill from reinventing slug derivation, frontmatter assembly, collision checks, and INDEX/GRAPH regeneration in prose. The skill body becomes a short instruction set that gathers the seven inputs from the user and invokes `ai-knowledge-base node add` via Bash.

## Skills Required
- `prompt-engineering`: rewrite a Claude Code skill body so the model gathers inputs then issues a single deterministic Bash invocation.

## Acceptance Criteria
- [ ] `src/templates-source/claude/skills/kb-add/SKILL.md` frontmatter `allowed-tools:` reads `Bash(ai-knowledge-base node add:*)` (no `Write`).
- [ ] The skill body is under 30 lines (excluding frontmatter).
- [ ] The body contains the same seven gathering questions (kind, title, summary, tags, body, relates-to, confidence) phrased for the user, then a single Bash invocation block.
- [ ] The Bash invocation uses `--body @-` with the markdown piped on stdin, includes `--yes`, and quotes each `--title`/`--summary` value to handle whitespace.
- [ ] No remaining prose about: slug derivation, ISO timestamp formatting, collision detection, H1 appending, "do not regenerate INDEX/GRAPH the hook handles it", or any manual frontmatter assembly.
- [ ] No reference to fields that no longer exist in node frontmatter post plan 09 (`valid_from`, `updated`, `supersedes`, etc.).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Claude Code skill body conventions (gather inputs, then a single tool call).
- The Bash invocation must be a single command. Multi-line is OK using a heredoc for the body content.

## Input Dependencies
- Task 1: the `ai-knowledge-base node add` CLI must accept the flag set this skill calls.

## Output Artifacts
- Rewritten `SKILL.md` that delegates to the CLI.

## Implementation Notes
<details>
<summary>Body structure to aim for</summary>

```markdown
---
name: kb-add
description: ...
allowed-tools: Bash(ai-knowledge-base node add:*)
---

# kb-add

Gather these seven inputs from the user before calling the CLI:

1. Kind: `practice` or `map`.
2. Title.
3. Summary (one line).
4. Tags (comma-separated).
5. Body (markdown).
6. Relates-to (comma-separated node ids, may be empty).
7. Confidence: `low`, `medium`, or `high`.

Then invoke:

```bash
ai-knowledge-base node add \
  --kind <kind> \
  --title "<title>" \
  --summary "<summary>" \
  --tags "<tags>" \
  --relates-to "<relates-to>" \
  --confidence <confidence> \
  --body @- \
  --yes <<'EOF'
<body markdown>
EOF
```

The CLI handles slug derivation, collision detection, frontmatter assembly, and INDEX/GRAPH regeneration. The reviewer accepts via `git commit` and rejects via `git restore`.
```

Iterate on phrasing as needed but keep the overall shape. Remove every instruction that the CLI already does. Run `wc -l` on the resulting SKILL.md body to confirm the line budget.

</details>
