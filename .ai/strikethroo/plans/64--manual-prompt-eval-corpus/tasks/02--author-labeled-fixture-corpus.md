---
id: 2
group: "prompt-eval"
dependencies: []
status: "pending"
created: 2026-07-19
skills:
  - technical-writing
  - yaml
complexity_score: 6
complexity_notes: "Emitted as-is deliberately: plan 64 mandates corpus authoring as a single supervised blueprint task with a human review gate, so it must not be split; the score reflects the volume (48 files) and judgment involved in labeling, not ambiguous criteria — the category table, sidecar schema, and self-check loop are fully specified."
execution_profile: "complex-architecture"
---
# Author the labeled fixture corpus (supervised)

## Objective

Author the 24 synthetic session logs and 24 expected-labels sidecars under
`tests/fixtures/prompt-eval/`, plus the corpus `README.md`, by executing the
corpus-authoring prompt embedded in GitHub issue #113, grounded in the
vendored Drupal pack. This is a supervised task: the user reviews every
generated file via git diff before committing; the agent does not commit.

## Skills Required

- `technical-writing` — realistic synthetic session transcripts with genuine
  teaching moments, traps, and salvage narration; README provenance prose.
- `yaml` — session frontmatter and sidecar files that parse strictly.

## Acceptance Criteria

- [ ] Layout is `tests/fixtures/prompt-eval/sessions/<category>-<nn>.md` and
      `tests/fixtures/prompt-eval/expected/<category>-<nn>.yaml`, a sibling of
      `retrieval-eval/` — verify:
      `ls tests/fixtures/prompt-eval/sessions/*.md | wc -l` prints `24` and
      `ls tests/fixtures/prompt-eval/expected/*.yaml | wc -l` prints `24`.
- [ ] Category counts match issue #113's table exactly: 11 admit
      (convention ×2, prohibition ×2, gotcha ×2, rationale, tooling,
      map-feature, map-vocab, map-location), 9 reject (abandoned ×2,
      exploratory ×2, unrelated, meta-only ×2, noise ×2), 2 mixed-salvage,
      2 trap-phantom.
- [ ] Every session file has valid YAML frontmatter: `schema_version: 1`, a
      fixed valid UUID v4 `session_id` unique across the corpus,
      `harness: claude`, a fixed ISO `captured_at`; the body is role-tagged
      `[USER]:`/`[AGENT]:` matching the transcript-rendered logs capture
      writes to `_sessions/`.
- [ ] Every sidecar conforms to the issue #113 schema (`fixture_id`,
      `category`, `expect_empty`, `expected_points` with `id`, `type`
      practice|map, `must_match_all` lowercase substrings, optional
      `must_not_match`, `max_unexpected_proposals`, `notes`), with field
      naming consistent with `golden-queries.yaml` where overlapping
      (`category`, `expect_empty`).
- [ ] `must_match_all` terms are 2–4 distinctive, domain-anchored substrings
      drawn from the vendored pack's vocabulary, each verifiably present in
      the session's teaching content; salvage fixtures put ticket narration
      in `must_not_match`.
- [ ] The issue's deterministic self-check loop has been run over the corpus
      and passes.
- [ ] Admitted knowledge is not already stated verbatim in the vendored pack
      (duplicate-teaching sessions belong to the future curator corpus).
- [ ] No real or fake-looking secrets, tokens, hostnames, or personal data
      anywhere (public repo).
- [ ] `tests/fixtures/prompt-eval/README.md` exists in the provenance style
      of `tests/fixtures/retrieval-eval/drupal/README.md`: corpus version,
      the full authoring prompt verbatim, the category table, and a numbered
      re-authoring/refresh procedure.
- [ ] The user has reviewed every generated file via git diff; rejected
      fixtures were deleted and re-authored, not patched around. Nothing is
      committed by the agent.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Read-only inputs: `src/templates-source/prompts/proposal-extract.md`
  (Version: 5), the referenced `knowledge-admission.md` (Version: 2), PRD
  section 6, and every node in
  `tests/fixtures/retrieval-eval/drupal/` (26 OKF-v3 nodes). Do not modify
  any #115 code or fixtures.
- The corpus-authoring prompt is embedded in GitHub issue #113; execute it
  verbatim and commit it into the corpus README for provenance.
- Fixed timestamps and UUIDs keep fixtures deterministic — no generated-at
  values that change between runs.

## Input Dependencies

None among plan-64 tasks. External inputs: issue #113 (authoring prompt,
category table, sidecar schema, self-check loop) and the vendored pack landed
via #115.

## Output Artifacts

- 24 session fixtures and 24 sidecars under `tests/fixtures/prompt-eval/` —
  consumed by task 3 (structural-invariant test) and by manual eval runs.
- `tests/fixtures/prompt-eval/README.md` — provenance and refresh procedure.

## Implementation Notes

<details>
<summary>Detailed guidance</summary>

- Fetch issue #113 (https://github.com/e0ipso/kenkeep/issues/113) first; its
  embedded authoring prompt is the executable spec. Absorb the two prompts
  under eval and the whole vendored pack before writing any fixture.
- Category-to-filename mapping: use the category slug from the issue's table
  as the filename prefix (e.g. `admit-convention-01.md` /
  `admit-convention-01.yaml` or the issue's exact naming if it specifies
  one), with `fixture_id` equal to the shared basename so session↔sidecar
  pairing is mechanical.
- The confidence-bias rule prices a phantom convention above a missed one:
  `max_unexpected_proposals` is 0 almost everywhere; reject and trap
  fixtures must genuinely tempt extraction (plausible-looking but
  non-durable content), not be trivially empty.
- Reject sessions must contain no durable knowledge on careful reading;
  admit sessions' teaching moments must not be derivable from generic
  context. Subtly mislabeled fixtures corrupt the whole eval — when in
  doubt, flag the fixture to the user during review rather than guessing.
- Sessions should be consistent with the pack's domain (Drupal module names,
  entity types) so the same domain can host the future curator-phase corpus,
  but must not teach knowledge already in the pack.
- Workflow: author all 48 fixture files plus README, run the issue's
  self-check loop, fix findings, then stop and present the diff for the
  user's per-file review. Do not commit.

</details>
