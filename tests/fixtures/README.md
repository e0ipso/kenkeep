# Test fixtures

These fixtures drive the integration and golden-file tests described in IMPLEMENTATION.md §13.

## `transcripts/`

### `routine-zero/`

Lower-bound stage-2 calibration. A synthetic Claude Code session containing only routine work — bug fixes, refactors, file exploration, agent paraphrasing of user instructions. The stage-2 extraction prompt must produce `{"practice": [], "map": []}` on this input. Any output here is over-capture.

### `bravo-insider/`

Upper-bound stage-2 calibration. A synthetic session containing four teaching moments, three new-feature introductions, decision rationale, and several routine items that must be ignored. The stage-2 prompt should produce 4 practice candidates and 3 map candidates (see `expected.md`).

`existing-kb.md` is the fixture KB used to test curator decisions against the bravo-insider stage-2 output. It contains four existing nodes — one stale, one default-with-exception — chosen to exercise modify/contradict/add-with-relates_to behavior.

## `bootstrap-docs/`

A BravoPlatform-style Drupal docs tree used as input for both bootstrap pipelines:

- `/kb-bootstrap` agent-driven first-time bootstrap.
- `ai-knowledge-base bootstrap-incremental` CLI.

`expected.md` annotates which proposals each pipeline should produce, with reasoning for confidence levels and merge behavior across docs.
