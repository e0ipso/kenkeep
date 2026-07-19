# Test fixtures

These fixtures drive the integration and golden-file tests described in IMPLEMENTATION.md §13.

The `retrieval-eval/` family contains frozen Drupal and synthetic corpora plus declarative golden queries for production prompt-retrieval evaluation.

## `transcripts/`

### `routine-zero/`

Lower-bound proposal calibration. A synthetic Claude Code session containing only routine work (bug fixes, refactors, file exploration, agent paraphrasing of user instructions). The proposal extraction prompt must produce `{"practice": [], "map": []}` on this input. Any output here is over-capture.

### `bravo-insider/`

Upper-bound proposal calibration. A synthetic session containing four teaching moments, three new-feature introductions, decision rationale, and several routine items that must be ignored. The proposal extraction prompt should produce 4 practice candidates and 3 map candidates (see `expected.md`).

`existing-kb.md` is the fixture knowledge base used to test curator decisions against the bravo-insider proposal output. It contains four existing nodes (one stale, one default-with-exception) chosen to exercise modify/contradict/add-with-relates_to behavior.

## `bootstrap-docs/`

A BravoPlatform-style Drupal docs tree used as input for both bootstrap pipelines:

- `/kk-bootstrap` agent-driven first-time bootstrap.
- `kenkeep bootstrap-incremental` CLI.

`expected.md` annotates which proposals each pipeline should produce, with reasoning for confidence levels and merge behavior across docs.
