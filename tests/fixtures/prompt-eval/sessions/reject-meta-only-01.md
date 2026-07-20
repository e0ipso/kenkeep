---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000017
harness: claude
captured_at: '2026-01-15T11:20:00.000Z'
---
[USER]: <command-message>kk-curate</command-message>
<command-name>/kk-curate</command-name>
<command-args></command-args>
[USER]: Base directory for this skill: /workspace/.claude/skills/kk-curate

# kk-curate

Review pending captured sessions, validate curator actions, and write only human-approved knowledge-base changes.
[AGENT]: I’ll inspect the pending queue and show any questionable candidate before persistence.
[AGENT]: The queue contains a captured planning session for a possible Beacon dashboard. Its draft proposal says dashboard queries must always use `accessCheck(TRUE)` before results are counted.
[USER]: Show me why that proposal was extracted before writing anything.
[AGENT]: The source is a rule-shaped sentence inside a planning discussion. The same session ends with the dashboard and its query design awaiting stakeholder approval.
[AGENT]: That candidate fails the end-state gate. I have not written it to `nodes/`.
[USER]: Drop it. `/kk-curate` must not turn an unapproved planning candidate into project knowledge.
[AGENT]: I marked the candidate as dropped and ran the deterministic persistence step with zero surviving actions.
[AGENT]: The index rebuild reports no node changes, and `git diff` is empty under the knowledge base.
[USER]: Finish the curation run and report only its outcome.
[AGENT]: Curation completed with zero knowledge-base changes. This session only reviewed extraction output and did not establish dashboard behavior.
