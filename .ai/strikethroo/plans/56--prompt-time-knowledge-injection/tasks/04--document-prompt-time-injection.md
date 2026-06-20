---
id: 4
group: "prompt-time-knowledge-injection"
dependencies: [2, 3]
status: "pending"
created: 2026-06-20
skills:
  - documentation
  - harness-adapters
complexity_score: 5
complexity_notes: "Documentation must reflect the final supported harness matrix and prompt-time behavior accurately."
---
# Document Prompt-Time Injection

## Objective
Update project documentation to describe prompt-time knowledge injection, its bounded payload, and supported harness behavior after implementation is concrete.

## Skills Required
Documentation skill for concise user-facing and internals updates, plus harness adapter knowledge to avoid overstating unsupported prompt-time behavior.

## Acceptance Criteria
- [ ] `docs/internals/hooks.md` explains the prompt-time hook, bounded summaries-plus-links payload, synchronous/failure-open behavior, and supported harnesses.
- [ ] Documentation that currently says SessionStart/`ENTRY.md` is the only consume surface is audited with `rg` and updated where directly contradicted, including `docs/internals/kk-navigation.md` if its "only viable surface" wording is no longer true.
- [ ] `AGENTS.md` describes prompt-time injection behavior only for the harnesses actually implemented.
- [ ] `docs/installation.md` or the appropriate user-facing harness-support page names which harnesses support prompt-time injection and which remain session-start-only.
- [ ] `PRD.md` §13 is updated if this feature resolves the deferred open question about task-filtered index injection.
- [ ] Documentation preserves existing session-start orientation behavior and does not imply `ENTRY.md` injection was replaced.
- [ ] Prompt or documentation changes that affect shipped prompt behavior are called out according to existing project conventions if applicable.
- [ ] Generated docs output such as `docs/_site` is not edited by hand.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Base the support matrix on the code merged in task 2 and tests from task 3. Do not document aspirational harness support. Keep the explanation aligned with product constraints: no daemons, no external runtimes, markdown-in-git storage, no prompt text logging, and no LLM-backed prompt retrieval.

## Input Dependencies
Depends on task 2 for final supported harness behavior and task 3 for verified semantics.

## Output Artifacts
- Updated `docs/internals/hooks.md`.
- Updated `docs/internals/kk-navigation.md` and any other directly contradictory docs found by `rg`, if needed.
- Updated `AGENTS.md`.
- Updated user-facing harness support docs, if needed.
- Conditional `PRD.md` update if the open question is resolved.
- Any required changelog or prompt-version note if implementation changes prompt templates.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Document from the user's perspective first: session start still injects the root catalog for orientation, while prompt time injects a small list of likely relevant nodes after the user prompt is known for the harnesses that support it. Mention that payload entries are summaries and links, not authoritative full node bodies, and that agents should open linked leaves before relying on details.

For internals, include where hook sources live, how templates are generated, the hard-deadline/failure-open behavior, and which adapters register prompt-time hooks. If a harness is unsupported because the host lacks a suitable injection channel, say that plainly and leave it unchanged.

Only update `PRD.md` §13 if the implemented behavior genuinely answers the deferred task-filtered injection question. Keep wording narrow enough that future harness support can be added without contradicting this documentation. This feature is expected to avoid editing `src/templates-source/prompts/*.md`; if that changes, bump the affected prompt's `Version:` comment and call it out explicitly.
</details>
