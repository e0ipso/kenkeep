---
title: Proposal extraction evaluation
parent: Internals
nav_order: 7
---

# Proposal extraction evaluation

Use this procedure when considering a `Version:` bump to
`src/templates-source/prompts/proposal-extract.md` or
`src/templates-source/prompts/knowledge-admission.md`. It evaluates the built
proposal extraction prompt against the frozen labeled sessions in
`tests/fixtures/prompt-eval/`.

The evaluator is an explicit maintainer action run from a Kenkeep source
checkout. It is not part of the published consumer CLI, and it never runs from
a hook, nudge, background process, or CI workflow. One invocation launches a
fresh isolated process through the selected harness adapter for every fixture,
validates each structured result, scores the run, and prints a Markdown report.

## Run the evaluation

Choose the harness and confirm that its CLI is installed and authenticated.
Then run:

```sh
npm run prompt-eval -- --harness <id>
```

`<id>` must be one of `claude`, `codex`, `copilot`, `cursor`, or `opencode`.
The harness is required rather than inferred so the report always identifies
the system that produced it.

The npm script builds the current source first. The evaluator then:

1. Reads the built `templates/prompts/proposal-extract.md`.
2. Starts a separate headless harness process for each of the 24 session
   fixtures. Each child receives `KENKEEP_BUILDER_INTERNAL=1`, so its own
   capture and proposal hooks do not recurse.
3. Validates every final response against `ProposalOutputSchema` before writing
   it as JSON.
4. Starts a fresh same-harness semantic-judge process for each positive fixture
   that emitted at least one proposal, and validates its facet judgments.
5. Runs the deterministic evidence validator and one-to-one scorer.
6. Prints one Markdown report and saves the report, validated proposals,
   judgments, and raw harness event logs under an ignored run directory in
   `.ai/kenkeep/.state/prompt-eval/`.

The default worker pool runs two harness processes at a time. One corpus run
therefore makes 24 generation calls plus at most 13 semantic-judge calls. Check
provider cost and rate limits before raising concurrency or run count.

## Options

Run the corpus multiple times to expose model variance:

```sh
npm run prompt-eval -- --harness <id> --runs 3
```

Control process concurrency and the per-fixture timeout:

```sh
npm run prompt-eval -- --harness <id> --concurrency 4 --timeout-ms 180000
```

Useful path overrides are available for controlled experiments:

```sh
npm run prompt-eval -- --harness <id> \
  --fixtures-dir tests/fixtures/prompt-eval \
  --prompt-file templates/prompts/proposal-extract.md \
  --judge-prompt-file templates/prompts/prompt-eval-judge.md \
  --output-dir .ai/kenkeep/.state/prompt-eval/my-run
```

Model selection uses the chosen adapter and the project `proposalModel` entry
in `.ai/kenkeep/config.yaml`. If no matching entry exists, the harness uses its
own default. The report records the harness and resolved model options. Sampling
controls that are not exposed by the adapter remain harness-managed defaults.

## Read the report

For every run, the report includes:

- Valid results out of 24. A missing result means the harness failed, timed
  out, or returned output that did not match the strict schema.
- PASS or FAIL with reasons for every fixture.
- Passed and total counts by category.
- Expected-point recall, phantom count, and gate accuracy.
- Advisory proposal-kind mismatches.
- Valid semantic judgments for every positive fixture.
- Harness, model options, prompt version, run count, concurrency, timeout, and
  artifact location.

Prompt quality is advisory. Fixture score failures do not make the process exit
nonzero. A nonzero exit means the evaluation itself was incomplete because at
least one harness call, schema validation, or scoring operation failed. Fix the
execution problem before comparing prompt quality.

Each positive sidecar defines semantic claims with application-critical
required facets. After proposal generation, a fresh isolated call through the
same selected harness compares every expected point with every proposal. For
each facet it returns `entailed`, `not_entailed`, or `contradicted`, plus an
exact proposal excerpt for entailed or contradicted facets. The judge sees only
the claims, facets, and proposals. It does not see the transcript, run number,
harness identity, or current score.

The deterministic scorer validates complete comparison and facet coverage and
checks that every cited excerpt occurs in the proposal. A proposal is eligible
to match an expected point only when every required facet is entailed. Literal
`forbidden_substrings` remain available only for objective story leaks such as
ticket identifiers; they do not perform semantic matching.

The corpus labels every independently useful, indivisible concept in each
transcript, not only the fixture's headline teaching point. Matching is
one-to-one: a proposal can satisfy only one expected point, and an expected
point can consume only one proposal. A duplicate proposal therefore counts as a
phantom, while one over-broad proposal cannot satisfy several atomic concepts.
This keeps the score aligned with the knowledge base's granularity principle.
The sidecar's `preferred_type` is diagnostic only.

The judge uses the same harness and model options as proposal generation so the
evaluator remains usable across different subscriptions. Reports record the
judge prompt version and preserve judgment JSON and raw judge logs. Scores are
best used for regression testing within a harness; cross-harness comparisons
remain advisory because the semantic verifier is not a fixed model.

## Record and compare results

Paste the complete report into the PR that bumps the prompt `Version:`. Compare
it with the previous report using the same harness and model settings whenever
possible. Look for category regressions, not only aggregate movement:

- Expected-point recall measures retained durable, atomic teaching points.
- Gate accuracy measures rejection of noise and rule-shaped traps.
- Phantom count measures unexpected or redundant extra proposals.
- Kind mismatches show classification drift without changing semantic recall.
- Per-category results reveal whether a change helps one session shape while
  damaging another.

Optionally append reports to `tests/fixtures/prompt-eval/RESULTS.md` to build a
version-over-version history. The generated JSON and raw event logs under
`.ai/kenkeep/.state/` are local diagnostic artifacts and must not be committed.

Run the automated evaluator for Version 8 before shipping the prompt change,
then record its report as the comparison point for later prompt changes.
