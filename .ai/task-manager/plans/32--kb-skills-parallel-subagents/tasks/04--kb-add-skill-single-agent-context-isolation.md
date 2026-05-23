---
id: 4
group: "skill-prompts"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - prompt-engineering
  - markdown
---
# Add single host sub-agent delegation to `kb-add` SKILL.md for context isolation (parallelism N/A; same mechanism)

## Objective

Modify `src/templates-source/skills/kb-add/SKILL.md` so the single drafting pass for one node body is delegated to one host-native sub-agent — purely for **context isolation**, not throughput — when the runtime exposes a dispatch primitive. On harnesses without the primitive, the host drafts inline (today's shipped behaviour). The host always writes via `node write`; never the sub-agent.

## Skills Required

- `prompt-engineering` — same vendor-neutral probe + fallback pattern as Tasks 2 and 3, but with N=1.
- `markdown` — small structural edit; the file is short to begin with.

## Acceptance Criteria

- [ ] `src/templates-source/skills/kb-add/SKILL.md` keeps its intake block ("Ask the user for seven values…"), overlap-check paragraph, harness-resolution block, and final hand-off prose intact.
- [ ] The "Capture the node" section gains a probe + delegation block:
    1. **Probe**: same intent-based wording as Tasks 2/3.
    2. **Delegation path**: if a dispatch primitive is present, the host delegates the drafting of the node body to ONE sub-agent. The sub-agent is told to take the seven user-provided values, refine wording to fit body style (1–4 short paragraphs, present tense, project-specific), and write `{kind, slug, title, summary, tags[], confidence, relates_to[], body}` as JSON to a predetermined absolute path `_logs/kb-add/<runId>__1.draft.json`, then return the path.
    3. **Collector / write**: the host reads the tmpfile, validates the JSON, and calls `node write <kind> <slug> --title --summary --tags --relates-to --confidence <<EOF body EOF`. The host — never the sub-agent — invokes `node write`. (This is important: `node write` requires a tty-less stdin/heredoc and runs in the host's working directory.)
    4. **Fallback path**: today's inline drafting + `node write` flow — preserved byte-equivalent.
- [ ] Before delegating, the host explicitly tells the user (per plan Integration Risks §1): "Drafting this node in a sub-agent for context isolation; the agent's full reasoning is in `_logs/kb-add/<runId>.jsonl` if you want it." User-visible summary (final node id + file path + accept/reject instructions) is unchanged from today.
- [ ] mkdir `.ai/knowledge-base/_logs/kb-add/` happens before delegation; at minimum one JSONL line per run is appended to `_logs/kb-add/<runId>.jsonl` (orchestrator: "delegating"; collector: "drafted" or "draft-invalid").
- [ ] On schema-validation failure of the sub-agent's JSON, the prompt instructs the host to FALL BACK to inline drafting on the same call (do not abort) — this is the safety net that keeps `kb-add` always-completable.
- [ ] Vendor-neutral phrasing: zero new occurrences of harness ids or tool literals in the delegation block.
- [ ] `<!-- Version: N -->` bumped past the current `2`.
- [ ] Net SKILL.md size growth under ~30% (current file is ~98 lines, so target ≤~127 lines).
- [ ] `npm run build` succeeds.
- [ ] Per-harness regenerated copies under `.claude/skills/kb-add/`, `.codex/skills/kb-add/`, `.cursor/skills/kb-add/`, `.opencode/skills/kb-add/` are not hand-edited.

## Technical Requirements

- Canonical prompt path: `src/templates-source/skills/kb-add/SKILL.md`.
- The `node write` invocation is unchanged. `kb-add` does NOT pass `--source-doc` / `--source-hash`, and therefore the proper-lockfile change from Task 1 does not apply (`node write` skips the lock when those flags are absent — see Task 1 acceptance criteria).
- Pre-batch log dir is `_logs/kb-add/` under `.ai/knowledge-base/`.

## Input Dependencies

None.

## Output Artifacts

- Updated `src/templates-source/skills/kb-add/SKILL.md` with the single-sub-agent delegation block.
- Bumped `<!-- Version: N -->` comment.

## Implementation Notes

<details>

### Why delegation here at all?

`kb-add` has only ever one drafting unit per invocation — so this is not a throughput change. It exists for two reasons:

1. **Context isolation**: today the host's transcript fills with the sub-agent's intermediate reading/deliberation (the user's seven values, overlap-check against `INDEX.md`, draft iteration). Delegating cleans up the host transcript so the user sees only the final summary and accept/reject prompt.
2. **Uniformity**: the same probe/dispatch/fallback wording exists in all three skills (Tasks 2/3/4), so users see consistent behaviour across `kb-bootstrap`, `kb-curate`, and `kb-add` regardless of which harness they're on.

### Sub-agent instruction body

> You are refining ONE knowledge-base node body for the user.
> - Inputs are: kind=<kind>, title=<title>, summary=<summary>, tags=<tags>, relates_to=<relates_to>, confidence=<confidence>, body-draft=<body>.
> - Refine the body to 1–4 short paragraphs in present tense, project-specific. Do not invent rationale; if the user didn't provide it, omit it. Keep title and summary within their length caps (≤80, ≤140) and refine only for clarity.
> - Write the refined node as JSON to `<absolute predetermined path>` with these exact keys: `kind, slug, title, summary, tags, confidence, relates_to, body`. Derive `slug` from the title (lowercase, hyphen-separated, ASCII).
> - Return the path on success.

The host's collector turn then assembles the `node write` command from the JSON.

### Universal-prompt audit

```bash
grep -E "\b(claude|codex|cursor|opencode|Task|subagent_type)\b" src/templates-source/skills/kb-add/SKILL.md
```

Same rule: hits confined to the harness-resolver block.

### Skill scope

`prompt-engineering` + `markdown`. No CLI change. No other SKILL.md touched.

</details>
