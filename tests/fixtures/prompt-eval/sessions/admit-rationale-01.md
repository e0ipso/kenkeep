---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000007
harness: claude
captured_at: '2026-01-15T10:30:00.000Z'
---
[USER]: Add approval state to the translated article bundle in Atlas Editorial.
[AGENT]: I’ll inspect the bundle fields and existing workflow storage before choosing the representation.
[AGENT]: The simplest implementation is a list field on the article with draft, legal, and approved values. I’m checking whether revision-level workflow state already exists elsewhere.
[USER]: We deliberately keep approval in the `workflow_marker` content entity instead. Article fields did not handle our multilingual case: translations could diverge even though legal approval applies to the whole revision set.
[AGENT]: That changes the design. The marker should reference the revision set and expose one approval state to all translations.
[AGENT]: I found the marker storage service and an existing relationship for embargo state. I’ll reuse that seam without adding article field definitions.
[USER]: Right. Use `workflow_marker` for approval state because it keeps the decision translation-neutral while article copy remains translatable.
[AGENT]: The first kernel case accidentally created separate revision sets for English and French, so it passed without proving shared approval. I’m correcting the fixture to translate one revision set.
[AGENT]: With the corrected fixture, the article-field implementation fails because the two translations diverge. The marker implementation returns one approval state.
[USER]: Cover an English and French translation resolving to the same marker.
[AGENT]: The final kernel test loads both translations, resolves the same `workflow_marker`, and verifies the shared approval state.
[AGENT]: The focused suite passes, and the article bundle configuration is unchanged.
