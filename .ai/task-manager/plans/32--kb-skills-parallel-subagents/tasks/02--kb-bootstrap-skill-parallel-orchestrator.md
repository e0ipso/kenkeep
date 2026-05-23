---
id: 2
group: "skill-prompts"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - prompt-engineering
  - markdown
---
# Rewrite `kb-bootstrap` SKILL.md with intent-based sub-agent dispatch, sequential fallback, per-batch JSONL logs

## Objective

Modify `src/templates-source/skills/kb-bootstrap/SKILL.md` so the single canonical prompt drives both (a) a parallel host-native sub-agent path that drafts one node per candidate doc and (b) the existing sequential inline fallback, gated by a runtime probe the LLM performs on its own tool surface. Persist per-batch JSONL logs under `_logs/bootstrap/<runId>__<batchN>.jsonl`.

## Skills Required

- `prompt-engineering` — phrasing the intent-based dispatch instruction in vendor-neutral language so each harness's LLM (Claude `Task`, Cursor `Task`, Codex subagent workflow, opencode `@`-mention) maps it to its native primitive without the prompt naming any harness.
- `markdown` — restructure the SKILL.md so the orchestrator / probe / collector / fallback sections live alongside the existing steps without ballooning the file.

## Acceptance Criteria

- [ ] `src/templates-source/skills/kb-bootstrap/SKILL.md` keeps its current outline (Inputs, Configuration, Resolve the active harness, Steps 1–8, Constraints, When to stop) and integrates the new orchestration block into Step 6 (the "Draft each node body inline, then persist via `node write`" step).
- [ ] Step 6 explicitly instructs the LLM to:
    1. **Probe**: "If your runtime exposes a sub-agent / Task dispatch primitive on your tool surface, use the parallel path below; otherwise, use the inline path that follows after."
    2. **Parallel path** (orchestrator turn): partition the surviving docs (post-step-2 filter) into work units of ≤5 per concurrent wave (concurrency cap from plan §4); for each unit, delegate the drafting of that one doc to a sub-agent with focused instructions ("read this one doc, decide whether it warrants one or more nodes, draft each node, write the drafts as a JSON array to `<predetermined path>`, return the path"). Each agent's predetermined output path is `_logs/bootstrap/<runId>__<batchN>.draft.json`.
    3. **Collector turn**: read each tmpfile, validate against the existing in-skill node shape (use vocabulary already in the prompt — title/summary/tags/confidence/body, plus `kind`), funnel each validated draft through `node write <kind> <slug> --source-doc <relpath> --source-hash <sha256>`.
    4. **Fallback path** (existing inline draft+`node write` flow) — preserved byte-equivalent for any LLM that has no dispatch primitive.
- [ ] The prompt instructs the orchestrator to mint a `runId` (e.g. `bootstrap-$(date -u +%Y%m%dT%H%M%SZ)` or `uuidgen`) at the top of Step 6 and reuse it for every batch's tmpfile name.
- [ ] The prompt instructs the orchestrator to **mkdir -p `.ai/knowledge-base/_logs/bootstrap/`** before issuing any sub-agent, and to append at least one structured JSON line per batch to the matching `<runId>__<batchN>.jsonl` (e.g. orchestrator emits an "issued" line; collector emits a "result-validated" or "result-invalid" line). The agent's full sub-transcript is not expected to be inside the JSONL on every harness — see plan §3.
- [ ] The prompt phrasing is **vendor-neutral** — no occurrence of `Task`, `subagent_type`, `@`-mention, `claude`, `codex`, `cursor`, `opencode`, or any other harness or tool-specific literal inside the dispatch block.
- [ ] The concurrency cap (≤5 simultaneous sub-agents per orchestrator turn; issue in waves if N > 5) is written into the prose, with the rationale (~10 concurrent ceiling on the reference runtime; leave headroom).
- [ ] On failed JSON validation of a sub-agent's output, the prompt instructs the LLM to **surface "batch N produced invalid output, skipped"** to the user and continue with the next batch — never a hard abort.
- [ ] The probe + dispatch + fallback wording lives in one cohesive section the LLM cannot accidentally enter a half-state (probe and fallback discussed in the same paragraph; cf. plan §1).
- [ ] The `<!-- Version: N -->` comment near the top of the file is bumped (per `practice-bump-prompt-version-comment`) to a value strictly greater than the current `2`.
- [ ] Net SKILL.md size growth is under ~30% of the current file (mitigation for SKILL.md bloat risk; current file is ~218 lines, so target ≤~285 lines).
- [ ] The existing Constraints, "When to stop", and Steps 1–5, 7–8 sections are preserved unchanged in intent.
- [ ] `npm run build` succeeds (the templates pipeline copies this file into `templates/`).
- [ ] No per-harness regenerated copy under `.claude/skills/kb-bootstrap/`, `.codex/skills/kb-bootstrap/`, `.cursor/skills/kb-bootstrap/`, `.opencode/skills/kb-bootstrap/` is hand-edited — they regenerate from the canonical source via the existing template-sync mechanism.

## Technical Requirements

- The canonical prompt path is `src/templates-source/skills/kb-bootstrap/SKILL.md`. All edits go there; nothing else hand-edited.
- The `node write` invocation already shown in Step 6 (including `--source-doc` / `--source-hash`) is the persistence primitive — the collector reuses it verbatim. The proper-lockfile change inside `node write` (Task 1) makes concurrent collector calls safe.
- Pre-batch log dir is `_logs/bootstrap/` under `.ai/knowledge-base/`.

## Input Dependencies

None. (Task 1 makes parallel writes safe, but the SKILL.md edit does not depend on Task 1 being finished — the prompt change is independent of the CLI lock.)

## Output Artifacts

- Updated `src/templates-source/skills/kb-bootstrap/SKILL.md` with the new orchestrator/probe/collector/fallback section.
- Bumped `<!-- Version: N -->` comment.

## Implementation Notes

<details>

### Phrasing model for the dispatch instruction

Use vendor-neutral language like:

> If your runtime can dispatch a sub-agent / task to a separate context window, use the parallel path. Otherwise, use the inline path. To use the parallel path: for each work unit, dispatch a sub-agent with the following instructions… Do not invent a primitive that does not exist on your tool surface — if your only "dispatch" option is recursion into yourself or a shell subprocess, that does **not** count and you should use the inline path.

The "does not count" clause matters: opencode's `@`-mention is genuine delegation; a self-recursive `Bash` call into `<harness> -p` is NOT. The prompt should reject the latter explicitly so opencode (and any future harness whose only escape is `-p`) takes the fallback cleanly.

### Sub-agent instruction body (what each sub-agent is told)

The orchestrator turn passes the sub-agent something like:

> You are drafting knowledge-base node candidates for ONE source doc.
> - The doc is at relative path `<relpath>` with content hash `<sha256>`. Read it in full.
> - Decide whether it warrants 0, 1, or more nodes (practice or map; same rules as the parent skill's Step 5).
> - For each chosen node, produce: `{kind, slug, title, summary, tags[], confidence, body}` (no `id`, no frontmatter — the host stamps both).
> - Write the array as JSON to `<absolute predetermined path>`. The file must contain exactly the JSON array, nothing else.
> - Return the path on success.

Make the path **absolute** (the orchestrator computes it from `pwd` + the `_logs/bootstrap/<runId>__<batchN>.draft.json` relative). Sub-agents run in their own contexts and may not share the host's cwd reliably across harnesses.

### Per-batch JSONL log

Concrete write commands the orchestrator can emit (one per batch):

```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"issued\",\"runId\":\"$RUN_ID\",\"batchN\":$N,\"doc\":\"$RELPATH\"}" \
  >> .ai/knowledge-base/_logs/bootstrap/${RUN_ID}__${N}.jsonl
```

…and one collector-side line per batch with `event:"validated"` or `event:"invalid"`. The full sub-agent transcript is harness-specific; the JSONL is the lowest-common-denominator artefact.

### Concurrency cap wording

Plan §4 specifies ≤5 per orchestrator turn. The prose should say something like:

> Dispatch in waves of at most 5 sub-agents per orchestrator turn. If you have more than 5 work units, issue the first 5 in one assistant turn, await results, then issue the next 5. This keeps the runtime's concurrent-agent budget healthy and bounds rate-limit risk.

### Universal-prompt audit

Once the edit is done, run:

```bash
grep -E "\b(claude|codex|cursor|opencode|Task|subagent_type)\b" src/templates-source/skills/kb-bootstrap/SKILL.md
```

The hits MUST be confined to: (a) the existing harness-resolution block at the top of the file, (b) the existing `--harness "$HARNESS"` invocation in Step 7, and (c) prose that explicitly enumerates "claude, codex, cursor, opencode" inside the harness-resolver comment. The new dispatch block must produce ZERO additional hits.

### Skill scope

`prompt-engineering` + `markdown`. Do NOT touch other SKILL.md files, harness adapters, or docs. Those are separate tasks.

</details>
