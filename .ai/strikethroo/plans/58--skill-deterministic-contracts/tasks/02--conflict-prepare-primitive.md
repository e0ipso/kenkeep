---
id: 2
group: "deterministic-primitives"
dependencies: []
status: "pending"
created: 2026-06-27
skills:
  - typescript-cli
  - vitest
complexity_score: 5
complexity_notes: "Ports an ordered diff-ratio default rule and a multi-key sort/group out of skill prose into a tested primitive; behavior must match exactly."
---
# Add `kk conflict prepare` primitive (diff-ratio default + sort/group)

## Objective
Stop asking the LLM to hand-execute the conflict-resolution default computation
and sort/group ordering in `kk-curate` Step 7. Add a `kk conflict prepare`
primitive that reads the pending conflict files under
`.ai/kenkeep/conflicts/`, computes each conflict's default reply using the
**exact** existing diff-ratio rules, computes the sort/group order, and emits
JSON the skill renders before asking the user. The skill keeps presenting and
asking; only the deterministic computation moves into code. The reply tokens
(`y`/`n`/`s`/`k`) and conflict outcomes are unchanged.

## Skills Required
TypeScript CLI command implementation (commander registration, frontmatter
parsing via `gray-matter`, line-diff computation) and Vitest test design.

## Acceptance Criteria
- [ ] `node dist/cli.js conflict prepare --help` shows the command. (A `conflict` command group with a `prepare` subcommand, mirroring existing groups like `node` / `index` / `session-log`.)
- [ ] It lists every markdown file under `.ai/kenkeep/conflicts/`, keeps only those with frontmatter `status: pending`, and emits them in the exact current sort order: primary key `target_node_id` alphabetic with `null` last; ties preserve a deterministic secondary order. Consecutive pending conflicts sharing the same non-null `target_node_id` are grouped (group metadata emitted so the skill shows the existing node once per group).
- [ ] For each conflict it computes the default reply with these rules **in order, first match wins**: (a) if `lines_changed < 5` AND `proposed_confidence == "high"` → `y`; (b) else if `ratio > 0.5` → `n`; (c) else → `s`; and if there is no `target_node_id` (no existing node to diff) → `s`. Here `lines_changed` = line-granularity diff count between proposed body and existing node body, `total_lines` = `max(proposed lines, existing lines)`, `ratio` = `lines_changed / total_lines`.
- [ ] Output is a single JSON document the skill can render: ordered conflicts, each with `id`, `target_node_id`, group flag/first-in-group, the computed `default` token, and the fields the skill needs to present (existing node path/excerpt when resolvable, proposed title/summary). No user interaction happens in the primitive.
- [ ] Tests assert the computed default for representative diffs covering each branch (small high-confidence change → `y`; large change `ratio>0.5` → `n`; middling → `s`; missing target → `s`) and assert the sort/group order including the `null`-last rule.
- [ ] `npm run build`, `npm run typecheck`, and the new tests pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- New: `src/commands/conflict-prepare.ts` (and a `conflict` group registration in `src/cli.ts`).
- Parse conflict-file frontmatter with `gray-matter` (already a dependency); the conflict file shape is written by `curate-dedup` — read `src/commands/curate-dedup.ts` and the `kk-curate` SKILL Step 7 section for the exact frontmatter fields (`id`, `status`, `target_node_id`, `proposed_kind`, `proposed_title`, `proposed_confidence`, `candidate_origin`, `run_id`, `detected_at`) and body sections (`## Rationale`, `## Proposed node`).
- Resolve the existing node body by id (glob `nodes/**/<target_node_id>.md`) to compute the diff; reuse existing node-path/glob helpers in `src/lib/nodes.ts` / `src/lib/paths.ts` rather than re-implementing path resolution.
- Line diff may be a simple symmetric line-set/LCS difference; keep it deterministic and documented. Match the prose semantics ("number of lines that differ between the proposed body and the existing node body, diff at line granularity").

## Input Dependencies
None. (Independent of Task 1.)

## Output Artifacts
The `kk conflict prepare` command. Consumed by Task 6, which rewrites `kk-curate`
Step 7 to call it and only render/ask.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Read `src/templates-source/skills/kk-curate/SKILL.md` sections "7a. Sort and group pending conflicts", "7b/7c" (the diff-ratio default), and the conflict-file producer in `src/commands/curate-dedup.ts`. Port the rules verbatim — do NOT invent new thresholds. The current rules are: default order by `target_node_id` (alpha, null last); default reply rules (a)(b)(c) above; no-target → `s`.
3. The primitive is read-only and side-effect-free except stdout. It MUST NOT ask the user or mutate conflict files — the skill owns the interaction and the existing resolve flow stays.
4. Decide the line-diff definition once and document it in a comment; the tests pin it. A reasonable definition matching the prose: count lines present in one body but not the other (both directions), i.e. size of the symmetric difference at line granularity. Whatever you choose, ensure the four representative test cases land on the same default the prose would have produced.
5. Emit stable JSON (sorted keys not required, but ordering of the conflicts array IS the contract). Include a `group_id` or `first_in_group` boolean so the renderer shows the existing node once per group.
6. Test philosophy — "write a few tests, mostly integration": build a temp `.ai/kenkeep/conflicts/` fixture with a handful of conflict files plus matching `nodes/**` files, run `conflict prepare`, and assert the JSON order + each `default`. Test the algorithm, not `gray-matter`. One focused test file.
7. Run `npm run build`, `npm run typecheck`, and `npx vitest run` for the new test before declaring done. Report exactly which files changed.
</details>
