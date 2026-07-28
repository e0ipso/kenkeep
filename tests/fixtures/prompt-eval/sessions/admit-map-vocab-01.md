---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000010
harness: claude
captured_at: '2026-01-15T10:45:00.000Z'
---
[USER]: The API response calls this a quiet revision. Make sure the field description uses our meaning, not a generic editorial guess.
[AGENT]: I’ll search the DTO, schema, and workflow code for how the term is actually used before editing public text.
[AGENT]: `quiet_revision` appears in the response DTO and one condition that suppresses a review event, but there is no definition in comments or schema descriptions.
[AGENT]: My first reading was “metadata-only update with no new revision,” but the storage call still creates a revision. I need the project definition rather than inferring it.
[USER]: In this project, a quiet revision is an article revision that updates search and syndication metadata without reopening the visible editorial review lane.
[AGENT]: Does the restriction apply only to the review event, or are rendered body fields prohibited too?
[USER]: Yes. Quiet describes workflow impact, not storage. It creates a revision, skips Beacon Review Lane, and cannot change rendered body fields.
[AGENT]: I’ll document that vocabulary on the DTO and add validation that rejects a quiet revision containing rendered-body changes.
[AGENT]: The first validation case caught `body` but missed a nested component field. I’m reusing the rendered-field classifier rather than maintaining a second list.
[USER]: Good. Keep the public API phrase exactly `quiet revision`.
[AGENT]: The schema description now uses the exact public phrase and explains the workflow boundary.
[AGENT]: The DTO and validation tests pass for metadata updates, normal revisions, and nested rendered-field rejection.
