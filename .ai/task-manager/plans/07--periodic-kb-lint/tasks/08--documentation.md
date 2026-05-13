---
id: 8
group: "docs"
dependencies: [1, 2, 4, 5, 6]
status: "completed"
created: 2026-05-13
skills:
  - technical-writing
---
# Document the `lint` surface in README and IMPLEMENTATION

## Objective

Update the two architecture-of-record markdown files in the package root so future contributors and consumers can discover the lint feature without reading source.

## Skills Required

- technical-writing: prose changes to README.md and IMPLEMENTATION.md following the existing voice and structure.

## Acceptance Criteria

- [ ] `README.md` gains a short subsection under the existing CLI reference area for `ai-knowledge-base lint`, listing the four checks (dangling structured edges, slug/id naming, tag near-duplicates, orphans), naming the `lintEveryNSessions` cadence setting (default 50), and naming the SessionStart nudge behavior. The doctor vs lint contrast is mentioned in one line: doctor = install health; lint = content health.
- [ ] `IMPLEMENTATION.md` is updated in the hooks section to document `kb-lint-tick.mjs` (SessionEnd, async, recursion-guard, increment-counter-fire-on-threshold) and in the state section to document `lint-state.json` (schema fields and the role of each).
- [ ] No retrospective framing. No "previously the package did X" sentences. Describe the current design only.
- [ ] No em-dashes, en-dashes, or ` - ` separators in any prose. Use commas, colons, parentheses.
- [ ] No `AGENTS.md` or `.claude/skills/*` changes (the plan explicitly excludes them).
- [ ] `markdownlint` / `prettier --check` (whichever the repo enforces) is clean on the edited files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `/workspace/README.md` and `/workspace/IMPLEMENTATION.md`.
- The README's CLI reference section is the right home for the lint subsection; look for the existing `doctor` / `status` / `node add` blocks and follow the same heading depth and prose density.
- The IMPLEMENTATION.md hooks section should already describe `kb-capture.mjs`, `kb-proposal-drain.mjs`, and `kb-session-start.mjs`. Add `kb-lint-tick.mjs` alongside them with the same field structure.

## Input Dependencies

- Tasks 1, 2, 4, 5, 6 must be complete so the documented behavior matches the shipped behavior.

## Output Artifacts

- Edited `README.md`.
- Edited `IMPLEMENTATION.md`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Read the existing `## CLI` (or equivalent) section in `README.md`. Identify the subsection style used by `doctor` and `status`. Mirror it for `lint`. Suggested template:

   ```markdown
   ### `ai-knowledge-base lint`

   Runs four mechanical, no-LLM checks against `nodes/`:

   1. **Dangling structured edges**: any `relates_to` or `depends_on` reference that does not resolve to a node id is reported as an error.
   2. **Slug / id naming**: every node's `id` must equal `<kind>-<slug>`, and the filename must be `<id>.md` under `nodes/<kind>/`. Mismatches are errors.
   3. **Tag near-duplicates**: tags that normalize to the same form (case-folded, separator-stripped, single trailing-`s` stripped) are clustered and reported as findings when two or more variants exist.
   4. **Orphans**: nodes that neither reference nor are referenced by another node are reported as findings.

   Errors cause exit code 1; findings do not. Pass `--verbose` for a per-entry breakdown.

   The lint also runs automatically every `lintEveryNSessions` sessions (default 50, configurable in `config.yaml`) via a SessionEnd async hook. The summary surfaces at the next SessionStart as a single nudge line; running the CLI clears it.
   ```

2. In `IMPLEMENTATION.md`, find the hooks section. Add an entry under the same heading style as the existing three:

   ```markdown
   ### `kb-lint-tick.mjs` (SessionEnd, async)

   Counts sessions in `.state/lint-state.json` and, when the counter reaches `lintEveryNSessions`, runs the mechanical lint over `nodes/` and writes the result summary (`last_lint_at`, `last_errors`, `last_findings`) back to the state file. Resets the counter. Recursion-guarded by `KB_BUILDER_INTERNAL=1`.
   ```

3. In the same file, find the state section. Add an entry:

   ```markdown
   ### `.state/lint-state.json`

   Tracks the SessionEnd lint cadence. Schema:

   - `schema_version: 1`
   - `sessions_since_last_lint`: non-negative integer, increments on every SessionEnd, resets to 0 on each lint run.
   - `last_lint_at`: ISO 8601 timestamp of the most recent run, or `null` if the lint has never fired.
   - `last_errors`: count of error-class lint entries from the most recent run.
   - `last_findings`: count of finding-class entries from the most recent run.

   Atomic writes (`tmp` + rename). Tolerant reads (missing or malformed file falls back to defaults).
   ```

4. Run `npx prettier --check README.md IMPLEMENTATION.md` (or the project's equivalent) and fix any whitespace.

5. Do not modify `CHANGELOG.md` (the bootstrap-skip rule).

</details>
