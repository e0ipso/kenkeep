---
id: 5
group: "documentation"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-07-07
skills:
  - technical-writing
---
# Update doctor/lint Documentation for the New Diagnostics

## Objective
Document the two new diagnostic behaviors so the surfaces that enumerate what
`doctor` and `lint` report stay accurate: the per-harness install-status view,
and the two frontmatter-hygiene lint rules (tag stray-whitespace, empty folder
`summary`) with their one-line fixes.

## Skills Required
- **technical-writing**: update CLI help/description text and any
  `AGENTS.md`/`README` references that enumerate doctor/lint behavior; concise,
  matches existing doc voice.

## Acceptance Criteria
- [ ] The `doctor` command's help/description mentions the per-harness
      install-status view.
- [ ] The `lint` documentation (help text and any rule listing) includes the two
      new rules and their one-line fixes.
- [ ] Any `AGENTS.md`/`README` section that enumerates what `doctor`/`lint`
      reports is updated to match.
- [ ] **Verification:** `npm run build` exits 0, then `node dist/cli.js doctor
      --help` and `node dist/cli.js lint --help` show the updated text; `grep -rn`
      for the doctor/lint rule enumeration in `AGENTS.md`/`README*` shows the new
      rules present. `npm run lint` (docs must not break markdown/eslint checks)
      exits 0.

## Technical Requirements
- Locate the command help/description strings (commander/CLI wiring for `doctor`
  and `lint`) and the rule/behavior enumerations in `AGENTS.md` and `README*`.
- Keep wording consistent with the actual output shape produced by tasks 1–3
  (per-harness block; `tag-whitespace` / `empty-summary` findings with file +
  fix). No behavior change — text only.

## Input Dependencies
- Tasks 1, 2, 3 — documentation must describe the behavior those tasks actually
  ship (block shape, rule ids, one-line fixes).

## Output Artifacts
- Updated help text and repo docs describing the new diagnostics.

## Implementation Notes
This is text-only; introduce no runtime or behavior changes. If the project's
changelog is governed by Conventional Commits/semantic-release, ensure the
implementing commit message reflects the diagnostic enhancement so release notes
capture it (commit authoring is outside this task's file edits — just keep the
change scoped and describable).

<details>
<summary>Step-by-step implementation</summary>

1. Find the `doctor`/`lint` command definitions and their `.description(...)` /
   help strings; add a short mention of the per-harness status view (doctor) and
   the two hygiene rules with their fixes (lint).
2. `grep -rn "doctor" AGENTS.md README*` and `grep -rn "lint" AGENTS.md README*`
   to find behavior enumerations; update them to list the new view and rules.
3. Match wording to the real rule ids and output substrings shipped by tasks
   1–3 so docs and behavior agree.
4. `npm run build`, then confirm `node dist/cli.js doctor --help` and `node
   dist/cli.js lint --help` reflect the changes; run `npm run lint`.
</details>
