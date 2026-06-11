---
id: 3
group: "docs"
dependencies: []
status: "completed"
created: 2026-06-11
skills:
  - technical-writing
---
# De-Claude PRD and AGENTS Prose

## Objective
Neutralize Claude-first phrasing in `PRD.md` and `AGENTS.md` so the prose
matches the even-handed adapter architecture, without altering any factual
per-harness detail. Remove wording that implies Claude Code is the only or
default harness for skills or installation.

## Skills Required
- **technical-writing** — careful prose editing that preserves meaning and
  factual content while removing framing bias.

## Acceptance Criteria
- [ ] `grep -niE "claude code skill|no installation beyond claude|--assistants claude"`
      over `PRD.md` and `AGENTS.md` returns nothing.
- [ ] "the `kk-*` Claude Code skill" / "`kk-curate` Claude Code skill" style
      references become harness-neutral (e.g. "the `kk-*` skill").
- [ ] "No installation beyond Claude Code and Node 22+" becomes
      "beyond a supported harness and Node 22+" (or equivalent).
- [ ] `--assistants claude` is shown as one of several supported harness ids
      (or generalized), not as the canonical install invocation.
- [ ] All factual per-harness content is preserved — including the even-handed
      per-harness paragraph at `PRD.md:22` and the harness list at `AGENTS.md:3`,
      which already enumerate all five adapters and must not be narrowed.
- [ ] References to the pinned Claude Code CLI version that are genuinely
      Claude-specific facts (e.g. `AGENTS.md:135` release checklist) are left
      factual; only *framing* that implies Claude-only/default is neutralized.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Markdown prose only. No code or schema changes.
- Verified Claude-first hits to neutralize:
  - `PRD.md:36` — "No installation beyond Claude Code and Node 22+".
  - `PRD.md:87` — "The `kk-curate` Claude Code skill".
  - `PRD.md:103` — "the `kk-add` Claude Code skill".
  - `PRD.md:107` — "The `kk-bootstrap` Claude Code skill".
  - `PRD.md:143` — "`npx <pkg> init --assistants claude`".
  - `PRD.md:144` — "installs the `kk-add`, `kk-bootstrap`, and `kk-curate`
    Claude Code skills".
  - `PRD.md:177` — "invokes the `kk-bootstrap` skill inside a normal Claude
    Code session".
  - `AGENTS.md` — equivalent passages (the skill references and any
    install/default framing). `AGENTS.md:3` lists all five harnesses and is
    factual; preserve it.
- Note `PRD.md:22` is already even-handed (the plan flags it as the model to
  match) — do not touch its factual per-harness wiring detail.

## Input Dependencies
None. Pure prose edit; independent of the code-change tasks.

## Output Artifacts
- Updated `PRD.md` and `AGENTS.md` with harness-neutral framing and all factual
  per-harness content intact.

## Implementation Notes

<details>
<summary>Executable guidance</summary>

1. Run `grep -niE "claude code skill|no installation beyond claude|--assistants claude|claude code"`
   over `PRD.md` and `AGENTS.md` to enumerate every hit before editing.
2. For each "Claude Code skill" reference, drop "Claude Code" — the `kk-*`
   skills ship for all adapters. e.g. "The `kk-curate` Claude Code skill runs the
   curator on demand." → "The `kk-curate` skill runs the curator on demand."
3. `PRD.md:36`: "No installation beyond Claude Code and Node 22+." →
   "No installation beyond a supported harness and Node 22+."
4. `PRD.md:143`: keep the example runnable but neutral, e.g.
   "`npx <pkg> init --harnesses <id[,id,...]>`" (the runtime flag is already
   documented as `--harnesses`/`--harness` at `PRD.md:22`), or show `claude` as
   one id among `codex,cursor,opencode,copilot`. Do not invent a flag — confirm
   the real flag name in the codebase/`PRD.md:22` before writing it.
5. `PRD.md:144`: "installs the ... Claude Code skills" → "installs the ...
   skills". `PRD.md:177`: "inside a normal Claude Code session" → "inside a
   normal session".
6. In `AGENTS.md`, apply the same neutralizations to the equivalent passages.
   Leave `AGENTS.md:3` (the factual five-harness summary) and `AGENTS.md:135`
   (the release checklist's genuine Claude CLI version pin) as factual — only
   remove framing that implies Claude is the sole/default host.
7. Preserve every factual per-harness sentence. The goal is removing *favoritism
   framing*, not removing Claude — Claude remains one of the supported harnesses
   and may be named factually.
8. Re-run the acceptance grep to confirm zero hits for the three banned phrases.
</details>
