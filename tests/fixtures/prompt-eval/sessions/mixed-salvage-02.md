---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000022
harness: claude
captured_at: '2026-01-15T11:45:00.000Z'
---
[USER]: For DRP-731 we replaced a broken partner file twice, and the import error report kept pointing at shifting array offsets.
[AGENT]: I’ll inspect how Harbor Exchange assigns rejection identities before changing the report format.
[AGENT]: The importer labels failures with the zero-based loop index. Filtering runs before chunking, so the same source row can receive a different index between attempts.
[USER]: The history is irrelevant. Harbor Exchange rejection records identify a row by `source_row_id`, never by an array offset. Filtering and chunking can change offsets, while `source_row_id` remains the partner's stable reference.
[AGENT]: I’ll require `source_row_id` during parsing and persist it on each rejection record.
[AGENT]: The first test still used array offsets in the duplicate-rejection key. I’m replacing that key path too, not just the human-readable report field.
[USER]: Good. If it is missing, reject the row with a schema error rather than inventing an index-based identity.
[AGENT]: The missing-ID fixture now fails at schema validation before chunking. No index-based fallback is created.
[AGENT]: Filtering and chunk-size variants both point to the same stable source row in the rejection report.
[USER]: Keep DRP-731 and the replacement story out of the extracted rule.
[AGENT]: The importer and rejection entity use only the source-row identity rule.
[AGENT]: Focused import tests pass, and reusable comments contain neither the ticket nor the broken-file history.
