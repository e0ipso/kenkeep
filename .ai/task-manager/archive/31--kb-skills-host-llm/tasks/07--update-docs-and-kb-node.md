---
id: 7
group: "docs"
dependencies: [5, 6]
status: "completed"
created: 2026-05-23
skills:
  - technical-writing
---
# Update documentation, KB convention node, and changelog

## Objective
Update every user-facing and contributor-facing document affected by the new architecture: rewrite CLI / daily-use / architecture docs to describe the launcher + skill model, document the new primitives, document the `bootstrap-incremental` → `bootstrap` rename and its deprecation window, narrow the scope of the `practice-recursion-guard-kb-builder-internal` KB node, and add a changelog / release-notes entry covering the BC break and headless-throughput regression.

## Skills Required
- `technical-writing` — accurate, scannable documentation aligned with the post-change codebase.

## Acceptance Criteria
- [ ] `docs/cli-reference.md` — bootstrap / curate / node-add sections rewritten to describe the launcher + skill model. New `ai-kb finddocs`, `ai-kb node write`, `ai-kb curate dedup` commands fully documented (synopsis, flags, examples, exit codes). `bootstrap-incremental` → `bootstrap` rename and the deprecation alias are documented.
- [ ] `docs/daily-use.md` — explains that bootstrap / curate now run the LLM in the host harness session. Adds a note about host-context cost on large doc trees and recommends `.kbignore` / `--from` scoping. Adds the "no concurrent invocations" guideline.
- [ ] `docs/how-it-works.md` — architecture diagram and prose updated to show "launcher → host session → primitives" flow. References to per-batch sub-agents removed.
- [ ] `docs/internals/prompts.md` — runner-prompt section replaced with the merged skill-prompt section.
- [ ] `docs/troubleshooting.md` — adds an entry for the rename and an entry titled "bootstrap now uses more context — what changed".
- [ ] `AGENTS.md` — if it references the old commands or runner architecture, updated to match.
- [ ] `nodes/practice/practice-recursion-guard-kb-builder-internal.md` — narrowed scope: `KB_BUILDER_INTERNAL` applies only to the launcher's harness child, not to internal batchers (which no longer exist). Updated, **not** deleted.
- [ ] `CHANGELOG.md` (or equivalent release-notes file) — entry documents (a) the BC: `bootstrap-incremental` is aliased now, removed next release; (b) the new primitives; (c) the headless-throughput regression (single host session, no parallel sub-agent batches); (d) the removal of `proper-lockfile` and the documented single-author constraint.
- [ ] No doc still references `BootstrapRunner`, `CuratorRunner`, or `runHeadless`. `grep -rn "BootstrapRunner\|CuratorRunner\|runHeadless" docs/ AGENTS.md README.md` returns zero matches.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Cross-check every flag and command name documented against the actually-merged CLI surface from Tasks 1, 2, 3, 5. Pull the `--help` text directly when in doubt.
- The KB node update must keep the file's frontmatter schema valid and bump its modified date if the schema tracks one.

## Input Dependencies
- Task 5 — launcher behavior and rename are final.
- Task 6 — runner deletion is final; dependency list reflects what was actually removed.

## Output Artifacts
- A documentation set that reflects the post-change reality and tells users about the BC break, the throughput tradeoff, and the new primitives.

## Implementation Notes
<details>
<summary>Details</summary>

- The plan's "Documentation" section is the authoritative list of files to touch — work through it line by line.
- For the architecture diagram in `docs/how-it-works.md`, mirror the "Proposed" subgraph from the Mermaid diagram in the plan (lines ~70–80 of `plan-31--kb-skills-host-llm.md`).
- The release-notes entry should explicitly call out, per the plan's risk section, that headless-batch parallelism is gone by design and is not coming back; users with very large bootstraps should narrow `--from` or tighten `.kbignore`.
- Updating the KB convention node: open `nodes/practice/practice-recursion-guard-kb-builder-internal.md`, narrow the wording from "all internal sub-agents and batchers must inherit `KB_BUILDER_INTERNAL=1`" to "the CLI launchers must set `KB_BUILDER_INTERNAL=1` on the harness child they exec, so SessionStart hooks (nudges, capture prompts) do not re-fire inside that nested session". Mention that internal batchers no longer exist.
- After all edits, run a final `grep` sweep for the three forbidden symbols listed in the acceptance criteria.
- This task does not require running the test suite — but do verify docs render correctly in whatever previewer the repo uses (if any).

</details>
