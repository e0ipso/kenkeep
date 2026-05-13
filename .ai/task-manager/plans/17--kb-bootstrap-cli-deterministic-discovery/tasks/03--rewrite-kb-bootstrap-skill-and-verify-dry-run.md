---
id: 3
group: "skill-rewrite"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - claude-code-skills
  - typescript
---
# Rewrite `kb-bootstrap` SKILL.md and verify dry-run output is parseable

## Objective

Reduce the `kb-bootstrap` skill to its real job (judgemental scoping + content classification) by replacing the LLM-driven `Glob`/`Grep` survey with a single `ai-knowledge-base bootstrap-incremental --dry-run --from <scope>` call, deleting the hand-rolled hashing and state-file step, adding a final `ai-knowledge-base index rebuild` invocation, and trimming the "what to skip" prose to content judgement only. Verify (and adjust if needed) that the CLI's dry-run output is a clean, grep-able relpath list.

## Skills Required

- `claude-code-skills` — editing the SKILL.md frontmatter (`allowed-tools`, `name`, `description`), step structure, and constraints; the file is a Claude Code skill template.
- `typescript` — minor adjustment to `src/commands/bootstrap-incremental.ts` *only if* the dry-run output format proves fragile to parse and needs a stable channel.

## Acceptance Criteria

- [ ] `src/templates-source/claude/skills/kb-bootstrap/SKILL.md` frontmatter `allowed-tools` no longer contains `Bash(shasum:*)` or `Bash(sha256sum:*)`.
- [ ] `allowed-tools` includes scoped entries permitting the orchestration calls: `Bash(ai-knowledge-base bootstrap-incremental:*)` and `Bash(ai-knowledge-base index rebuild:*)` (match the existing scoped-Bash style in the repo).
- [ ] Step 1 ("Survey the structure") replaces the `Glob`/`Grep` enumeration with a single `ai-knowledge-base bootstrap-incremental --dry-run --from <scope>` call, parses the printed relpath list, and reports the count to the user for confirmation.
- [ ] Step 6 ("Track state") is deleted in full, along with the `bootstrap-state.json` schema, the `shasum`/`sha256sum` instructions, and the "use the Bash tool to compute SHA-256" prose.
- [ ] A new final step is added that runs `ai-knowledge-base index rebuild` to regenerate `INDEX.md` / `GRAPH.md` before the user reviews `git diff nodes/`.
- [ ] The "What to skip" list inside SKILL.md is trimmed to content-judgement items only (API reference dumps, boilerplate paragraphs in otherwise-useful docs, generic framework knowledge, aspirational TODOs). A one-liner cross-references the CLI's static skip (e.g. "filenames like LICENSE / CHANGELOG / INDEX.md are already filtered out by the CLI before you see the list").
- [ ] Steps 4 / 5 / 7 (practice/map distinction, write nodes, report back) and the `Constraints` section are preserved, with constraint bullets updated to drop references to shasum/sha256sum and the state-file write.
- [ ] `When to stop` section retains its judgement triggers but drops any mention of the state file.
- [ ] `grep -nE 'shasum|sha256sum|bootstrap-state\.json' src/templates-source/claude/skills/kb-bootstrap/SKILL.md` returns zero matches.
- [ ] Verification step performed: `pnpm build && node dist/cli.js bootstrap-incremental --dry-run --from <some-doc-scope>` (or the equivalent project command) emits a relpath list that is parseable with `grep '^  + '` (or whichever stable prefix the implementation lands on), and no STATIC_SKIPS-matching path appears in it.
- [ ] If the dry-run format proves fragile to parse (logger interleaving, dynamic prefixes), the CLI is adjusted in `src/commands/bootstrap-incremental.ts` so that the relpath list is unambiguously machine-readable. If no change is needed, document that the existing `  + <relpath>` prefix is stable.
- [ ] No em-dashes, en-dashes, or " - " hyphen-as-dash separators in any prose touched by this task (project convention).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Primary file: `src/templates-source/claude/skills/kb-bootstrap/SKILL.md`.
- Secondary file (only if needed): `src/commands/bootstrap-incremental.ts` around the `Dry-run:` block (see `src/commands/bootstrap-incremental.ts:95-98`).
- Preserve the heredoc-style FILE delimiters and any structural markers that template installation depends on. Do not move the file or rename it.
- The skill currently spans `SKILL.md:1-153`; the rewrite is targeted (Step 1 replacement, Step 6 deletion, new final step, frontmatter and constraints touch-ups), not a ground-up rewrite of unrelated sections.

## Input Dependencies

- Task 1: the CLI must already apply `STATIC_SKIPS` so the dry-run list the skill consumes is the curated list.

## Output Artifacts

- A rewritten `SKILL.md` that other components (the installer, the harness when discovering skills) will pick up unchanged structurally.
- Either confirmation that the existing dry-run output format is parseable, or a minimal patch to `bootstrap-incremental.ts` that makes it so.

## Implementation Notes

<details>

Currently `src/commands/bootstrap-incremental.ts:95-98` prints:

```
Dry-run: <N> file(s) would be processed in <M> batch(es); <U> unchanged.
  + <relpath>
  + <relpath>
```

via `log.plain('  + …')`. For the skill to grep these cleanly with `grep '^  + '`, this format is already adequate *if* `log.plain` writes to a predictable stream and is not interleaved with `log.info`/`log.success` on the same line. Verify the format during implementation by running:

```sh
pnpm build && node dist/cli.js bootstrap-incremental --dry-run --from docs 2>&1 | grep '^  + '
```

If the output is clean, leave the CLI unchanged and document the `  + ` prefix in the skill's Step 1 instructions. If it is not clean (mixed streams, prefix variations), the smallest workable fix is to keep the `  + ` lines on stdout and route `log.info`/`log.success` to stderr; do not introduce a new `--format` flag for this work.

SKILL.md rewrite outline (target shape, not literal text):

- **Frontmatter**: keep `name` and `description`. Update `allowed-tools` to: `Read, Glob, Grep, Write, Bash(mkdir:*), Bash(ai-knowledge-base bootstrap-incremental:*), Bash(ai-knowledge-base index rebuild:*)`. Drop `Bash(shasum:*)` and `Bash(sha256sum:*)`. Drop `Bash(mkdir:*)` only if no remaining step needs it (writing nodes uses `Write`, not `mkdir`; check before removing).
- **Configuration block**: unchanged (still reads `bootstrapModel` for sub-agent delegation).
- **Step 1 "Survey the structure"** (currently `SKILL.md:25-35`): replace with a `Bash` call to `ai-knowledge-base bootstrap-incremental --dry-run --from <scope>`. Parse the `  + <relpath>` lines. Report the count to the user and propose a judgemental sampling plan (entry points first, then modules, etc.). Note that LICENSE / CHANGELOG / INDEX.md / GRAPH.md style names are already filtered out by the CLI.
- **Step 2-3 (entry points, sampling)**: unchanged.
- **Step 4 "Identify candidates"**: unchanged structurally; trim the `Skip:` sub-list (currently `SKILL.md:64-69`) to content-judgement items only (API reference, boilerplate paragraphs in otherwise-useful docs, generic framework knowledge, aspirational TODOs). Replace the "Licenses, changelogs, contributor lists" bullet with the one-liner cross-reference described above.
- **Step 5 "Write nodes"**: unchanged.
- **Step 6 "Track state"** (currently `SKILL.md:100-122`): delete in full. No replacement.
- **New final step (replacing the old Step 7 number)**: "Refresh INDEX.md and GRAPH.md" — call `ai-knowledge-base index rebuild` so the indices reflect the new nodes before the user reviews `git diff nodes/`. Keep this distinct from the existing "Report back" step or merge the index-rebuild call into the first action of the report step; either is fine as long as the rebuild runs before the final summary is printed.
- **Step 7 (now last) "Report back"**: unchanged except that the summary should mention the index has been refreshed.
- **Constraints**: drop the `shasum`/`sha256sum`/`mkdir` references in the `Tools allowed` bullet; the rest of the constraints stay.
- **When to stop**: unchanged.

Validation grep commands to run at the end:

```sh
grep -nE 'shasum|sha256sum|bootstrap-state\.json' src/templates-source/claude/skills/kb-bootstrap/SKILL.md
# expected: zero matches, exit 1

grep -nE 'LICENSE|CHANGELOG|CODE_OF_CONDUCT|contributor' src/templates-source/claude/skills/kb-bootstrap/SKILL.md
# expected: zero or one match (the one-liner cross-reference). Inspect each hit and confirm it is intentional.
```

Resist the urge to refactor unrelated sections. The plan explicitly flags "Skill scope creep during rewrite" as a risk; this is a surface reduction, not a rewrite of judgement guidance.

</details>
