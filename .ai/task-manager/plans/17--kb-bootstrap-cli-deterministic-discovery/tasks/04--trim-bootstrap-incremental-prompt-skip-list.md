---
id: 4
group: "skill-rewrite"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - claude-code-skills
---
# Trim `bootstrap-incremental.md` "What to skip" and bump prompt Version

## Objective

Bring the `bootstrap-incremental` prompt template's "What to skip" guidance in line with the rewritten skill: drop the filename-based bullets (license files, code-of-conduct files, contributor lists, changelogs, release notes) because `STATIC_SKIPS` in `discoverMarkdownFiles` already filters those before the prompt sees them. Bump the `Version:` header to match the project's prompt-versioning practice.

## Skills Required

- `claude-code-skills` — editing a prompt template consumed by the `claude -p` subprocess inside `bootstrap-incremental`; the file lives under `src/templates-source/prompts/` and is part of the installed surface.

## Acceptance Criteria

- [ ] In `src/templates-source/prompts/bootstrap-incremental.md`, the `## What to skip` section retains only content-judgement bullets: API reference dumps, boilerplate, generic framework knowledge, narrative/marketing prose, TODOs/FIXMEs/aspirational content.
- [ ] The bullets that list "License files, code-of-conduct files, contributor lists." and "Changelogs and release notes." are removed.
- [ ] The `Version:` HTML comment header at the top of the file is incremented from its current value (currently `Version: 2`) to the next integer (`Version: 3`), in keeping with the prompt-versioning practice.
- [ ] No other section of the prompt is edited (Inputs, Output, What to extract, Confidence calibration, Ownership boundary, Rules all unchanged).
- [ ] No em-dashes, en-dashes, or " - " hyphen-as-dash separators in any prose touched by this task.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/templates-source/prompts/bootstrap-incremental.md`.
- The `## What to skip` section is currently at lines 69-78. Two bullets are removed; the rest stay.
- The `Version:` header is currently at line 4. Change `Version: 2` to `Version: 3`.

## Input Dependencies

None. This task is purely text editing and is logically independent of Task 1; it can run in parallel.

## Output Artifacts

- An updated prompt template that no longer asks the LLM to re-litigate filenames already filtered by the deterministic discovery layer.

## Implementation Notes

<details>

Replace the existing `## What to skip` section body (lines 70-77) with the trimmed version:

```markdown
## What to skip

- API reference dumps (auto-generated method lists, parameter tables).
- Boilerplate (standard MIT license preamble, generic CI badges).
- Generic framework knowledge (Drupal/React/Django basics that anyone reading the framework docs would know).
- TODOs, FIXMEs, and aspirational content ("we should eventually do X").
- Content that is purely narrative or marketing.
```

Note that the existing bullet "Boilerplate (standard MIT license preamble, generic CI badges)." is *kept* — it is a content judgement about paragraphs inside otherwise-useful docs, not a filename filter. Only the two filename-pattern bullets are dropped.

The `Version:` bump signals to operators that the prompt behaviour has changed and any cached extraction results upstream may need re-running. Do not edit other comment fields in the header (Used by, Owner contract).

Validation: `grep -nE 'LICENSE|CHANGELOG|contributor|code-of-conduct' src/templates-source/prompts/bootstrap-incremental.md` should return zero matches after the change (or only an incidental match that is clearly part of a content-judgement bullet; inspect each hit).

</details>
