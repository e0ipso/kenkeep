---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000023
harness: claude
captured_at: '2026-01-15T11:50:00.000Z'
---
[USER]: <command-message>kk-add</command-message>
<command-name>/kk-add</command-name>
<command-args></command-args>
[USER]: Base directory for this skill: /workspace/.claude/skills/kk-add

# kk-add

Gather one durable project convention or named thing, check the knowledge base for overlap, and write a reviewable node only after its meaning is clear.
[AGENT]: What project knowledge would you like to record?
[USER]: Add this: Beacon Review Lane migrations never use direct entity updates. They always use a queue migration.
[AGENT]: That reads like a durable prohibition. I’ll check the current catalog for overlap, but I also need to know whether the rule is adopted and what establishes it.
[AGENT]: The catalog has Beacon Review Lane architecture but no migration rule. Absence from the catalog is not evidence that the statement is approved.
[USER]: No. It came from an unapproved migration outline, and I invoked `/kk-add` only to see what fields it asks for.
[AGENT]: Then the candidate fails the durability and end-state checks. I will not draft or write a node from tentative planning material.
[USER]: End the skill without changing the knowledge base.
[AGENT]: The add workflow ended with no file written. `git diff` is empty under the knowledge base, and no migration approach was approved.
