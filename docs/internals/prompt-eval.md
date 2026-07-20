---
title: Manual proposal extraction evaluation
parent: Internals
nav_order: 7
---

# Manual proposal extraction evaluation

Use this procedure when considering a `Version:` bump to
`src/templates-source/prompts/proposal-extract.md` or
`src/templates-source/prompts/knowledge-admission.md`. It evaluates the prompt
against the frozen labeled sessions in `tests/fixtures/prompt-eval/`.

The score is advisory. The scorer always exits 0 and nothing gates on its
result. Every LLM step is a human action in an interactive session. Kenkeep
code must not launch a harness, add a hook or nudge, send a notification, or
run an LLM in CI for this evaluation.

## Before the run

Choose the model, temperature, and run count. These are the maintainer's call
for each run. Record all three alongside the final score because LLM output
varies and a single-run result is only a coarse signal.

Build the repository so the CLI validator and shipped prompt template are
current:

```sh
npm run build
```

Create a throwaway results directory:

```sh
mkdir -p tmp/prompt-eval-results
```

## Run each fixture by hand

For each `tests/fixtures/prompt-eval/sessions/<id>.md` file:

1. Start a fresh interactive LLM session yourself. Any harness is acceptable.
2. Provide `src/templates-source/prompts/proposal-extract.md`, followed by the
   fixture body, as the model input.
3. Save only the model's final JSON object to
   `tmp/prompt-eval-results/<id>.json`.
4. Validate that result with the deterministic CLI:

   ```sh
   node dist/cli.js validate proposal-output tmp/prompt-eval-results/<id>.json
   ```

If validation fails, treat the result as invalid. Do not have kenkeep code
retry or repair it. Any additional model attempt is another manual run and
must be reflected in the recorded run count.

## Score the run

After processing the fixtures, run the deterministic scorer:

```sh
node scripts/prompt-eval/score.mjs tests/fixtures/prompt-eval tmp/prompt-eval-results
```

The report lists PASS or FAIL for every fixture in fixture-id order, then
passed and total counts by category. Its aggregate section reports
expected-point recall, phantom count, and gate accuracy. A missing result is
reported as `FAIL <id>: result file missing`. Schema-invalid JSON is reported
as `FAIL <id>: result schema-invalid`.

The scorer always exits 0, including for missing or invalid results. Read the
report and apply human judgment. Do not use the exit code as a release gate.

## Record the result

Paste the complete score table into the PR that bumps the prompt `Version:`.
Alongside it, record the prompt version, model, temperature, and run count.
The changelog should call out the prompt change as required by the existing
prompt-versioning practice.

Optionally append the table and run metadata to
`tests/fixtures/prompt-eval/RESULTS.md` to build a version-over-version history.
The JSON files under `tmp/prompt-eval-results/` are throwaway. Commit only the
fixtures, sidecars, and optional history file.

The baseline Version 5 evaluation is a post-merge manual maintainer step. It
must be run and recorded after this procedure and corpus land.
