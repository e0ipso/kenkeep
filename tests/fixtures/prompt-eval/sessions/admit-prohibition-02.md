---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000004
harness: claude
captured_at: '2026-01-15T10:15:00.000Z'
---
[USER]: Add the referenced campaign title to the Beacon API normalizer.
[AGENT]: I’ll inspect how neighboring normalizers resolve references and then add the title without widening the response contract.
[AGENT]: The current class only has scalar fields. I can inject `entity_type.manager` and load the campaign entity during normalization.
[USER]: Stop. Beacon normalizers never load referenced entities through `entity_type.manager`. Use `beacon_reference.loader`; it applies the channel translation fallback that raw storage loads bypass.
[AGENT]: I found the loader service and two existing callers. I’ll discard the raw storage approach and inject `beacon_reference.loader` instead.
[AGENT]: The first unit test passed with a loader mock, but that does not prove the channel fallback. I’m locating the functional fixture that has translated campaign references.
[USER]: Exactly. This is a project-wide rule for every Beacon normalizer because the fallback is part of the API contract.
[AGENT]: I’m also grepping the other Beacon normalizers for direct storage loads so this change does not leave the same violation beside it.
[AGENT]: No other direct loads remain. The response now uses the title returned by the reference loader.
[USER]: Also assert that a missing French campaign falls back through the loader rather than returning an empty title.
[AGENT]: The fallback case failed before the loader wiring and now resolves the English campaign title for the French channel.
[AGENT]: Both focused normalizer tests pass, and the module has no `entity_type.manager` access in normalizer classes.
