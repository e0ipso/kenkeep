---
id: 13
group: "docs-alignment"
dependencies: [7, 8, 12]
status: "completed"
created: 2026-05-15
skills:
  - technical-writing
---

# PRD, README, docs/* updates, new TOML coexistence page, CONTRIBUTING

## Objective

Bring all narrative documentation in sync with the dual-harness reality: rewrite PRD sections 2 and 11, update README to mention Codex, add a Codex section to `docs/installation.md`, document `--harness <id>` in `docs/cli-reference.md`, note the Codex Stop-only capture in `docs/how-it-works.md`, and add a new `docs/installation/codex-toml-hooks-coexistence.md` page describing the manual TOML merge procedure. Append a "Adding a new harness adapter" section to `CONTRIBUTING.md`.

## Skills Required

- technical-writing (markdown, accurate description of CLI behavior and file layouts)

## Acceptance Criteria

- [ ] `PRD.md` section 2 ("Two cooperating pieces") describes Claude Code and Codex CLI as the supported harnesses, without retrospective framing (per `feedback_no_retrospective_framing`)
- [ ] `PRD.md` section 11 ("Out of scope for v1") no longer lists "Multi-assistant adapters beyond Claude Code"
- [ ] `README.md` mentions Codex support alongside Claude in the assistants/install sections, including `npx @e0ipso/ai-knowledge-base init --harnesses codex` and a one-line note about `.agents/skills/`
- [ ] `docs/installation.md` gains a top-level "Codex CLI" subsection parallel to the existing Claude one, covering: `--harnesses codex`, the `.codex/` layout, `.agents/skills/`, the `--harness <id>` flag, and the Stop-only capture gap (no `SessionEnd`/`PreCompact`)
- [ ] `docs/cli-reference.md` documents the `--harness <id>` global option
- [ ] `docs/how-it-works.md` updated capture-pipeline section notes Codex captures on `Stop` only
- [ ] New file `docs/installation/codex-toml-hooks-coexistence.md` (create the `docs/installation/` subdir if needed) walks through the manual `.codex/config.toml` `[hooks]` merge with copy-paste-ready TOML; URL matches what Task 8's TOML-guard error message references
- [ ] `CONTRIBUTING.md` gains a "Adding a new harness adapter" subsection listing: implement `HarnessAdapter`, register in `src/harnesses/registry.ts`, add hook scripts under `src/harnesses/<id>/hooks/`, add templates under `src/templates-source/<id>/`, add doctor checks, add a harness id discriminator option in the model schema, write tests
- [ ] No use of em-dashes or hyphen-as-dash in any of these documents (per `feedback_no_em_dashes`); use commas, colons, or parentheses

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Markdown formatting consistent with the existing docs/ style
- All `npx ai-knowledge-base ...` references must use the scoped `npx @e0ipso/ai-knowledge-base ...` form (per `project_cli_invocation_npx_scoped`)

## Input Dependencies

- Task 7 (Codex adapter shape — describes the file layout)
- Task 8 (TOML guard — provides the docs URL reference)
- Task 12 (skill templates — describes what gets installed)

## Output Artifacts

- Updated `PRD.md`, `README.md`, `docs/installation.md`, `docs/cli-reference.md`, `docs/how-it-works.md`, `CONTRIBUTING.md`
- New `docs/installation/codex-toml-hooks-coexistence.md`

## Implementation Notes

<details>
<summary>Guidance</summary>

- Section 2 of PRD before this change describes Claude Code as "the v1 supported assistant." Rewrite to describe both harnesses as currently supported, with no language like "originally" or "previously."
- The TOML coexistence page should include a short example showing a user's existing `[hooks]` section, then a "here is the merged version" example with both their entries and ours. End with a note that we cannot auto-merge because TOML round-tripping risks losing comments/whitespace.
- `docs/cli-reference.md`: the `--harness` flag is global (inherited by every subcommand). Show one example per subcommand if patterns differ; otherwise a single global section is fine.
- `docs/how-it-works.md` capture-pipeline section: add a brief table or callout listing which capture events fire per harness (Claude: Stop + SessionEnd + PreCompact; Codex: Stop only).
- README: keep it short. One sentence acknowledging Codex support + one example command is enough.

</details>
