---
title: Bootstrap-incremental prompt
parent: Customization
nav_order: 3
---

# Editing the bootstrap-incremental prompt

Controls what `bootstrap-incremental` treats as candidates from your source docs. For the agent-driven `/kb-bootstrap` skill, edit `.claude/skills/kb-bootstrap/SKILL.md` instead.

## Where it lives

| Path | Used by |
|---|---|
| `templates/prompts/bootstrap-incremental.md` (npm package) | Bundled fallback. |
| `.ai/knowledge-base/.state/prompts/bootstrap-incremental.md` (your repo) | Preferred by the CLI. |

## Sections

1. **Inputs**: chunk format (`=== FILE: <path> ===` ... `=== END FILE ===`).
2. **Output**: JSON shape and candidate fields.
3. **What to extract**: trigger patterns per kind.
4. **What to skip**: auto-generated reference, licenses, generic framework knowledge, aspirational TODOs.
5. **Confidence calibration**.
6. **Rules**: "never invent facts", "quote rationale verbatim", "emit only the JSON object".

The chunk replaces `[CHUNK PLACEHOLDER — substituted at runtime]`. If removed, the chunk is appended at the end.

Bump the top-of-file `Version: N` comment on behavior changes.

## Calibration loop

1. Pick 3-5 representative docs.
2. `bootstrap-incremental --from <subset> --dry-run`.
3. Run without `--dry-run`. Review proposals.
4. Note false positives and false negatives. Adjust "trigger patterns" and "what to skip".
5. Delete `bootstrap-state.json` and re-run.
6. Repeat until acceptance is around 60-80%. Higher rates tend to drop true positives.

## Common edits

- Add project-specific trigger phrases (e.g., "Bravo invariant: ...").
- Name boilerplate categories you keep seeing in proposals.
- Adjust confidence defaults for known-stale docs.
