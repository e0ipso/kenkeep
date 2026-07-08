---
id: 1
group: "ci-workflow"
dependencies: []
status: "completed"
created: 2026-07-07
skills:
  - github-actions
  - yaml
---
# Author the read-only kenkeep-check GitHub Actions workflow

## Objective

Create `examples/kenkeep-check.yml` at repo root: a copy-paste, strictly read-only
GitHub Actions workflow that runs the three deterministic kenkeep health signals
(`lint`, `doctor`, `freshness`) plus the read-only drift-catcher
(`index rebuild && git diff --exit-code`), and posts/updates a single PR comment
summarising findings and nudging a human to run `/kk-curate` or
`kenkeep index rebuild` locally. The workflow never mutates `nodes/`, never runs
an LLM, and never opens auto-commits.

## Skills Required

- `github-actions` — triggers, step outputs, `peter-evans/find-comment` +
  `peter-evans/create-or-update-comment`, permissions, `actions/checkout`,
  `actions/setup-node`.
- `yaml` — valid GitHub Actions YAML; inline comments documenting the
  read-only / non-committing semantics.

## Acceptance Criteria

- [ ] `examples/kenkeep-check.yml` exists at repo root.
- [ ] `python3 -c "import yaml; yaml.safe_load(open('examples/kenkeep-check.yml'))"`
      exits 0 (YAML parses cleanly).
- [ ] `rg -n 'curate|bootstrap|node write|pack import|session-log|place apply|rebalance move' examples/kenkeep-check.yml`
      returns zero matches (no forbidden/LLM/mutating commands).
- [ ] `rg -n 'kenkeep (lint|doctor|freshness|index rebuild)' examples/kenkeep-check.yml`
      shows the four expected read-only commands.
- [ ] `rg -n 'fetch-depth: 0|contents: read|pull-requests: write|peter-evans/find-comment|peter-evans/create-or-update-comment|<!-- kenkeep-check -->' examples/kenkeep-check.yml`
      matches each required token.
- [ ] The drift-catcher step runs
      `npx --yes kenkeep index rebuild && git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md`
      and its inline comment states the regeneration is local-only, never
      staged/committed, never writes to `nodes/`.
- [ ] The `doctor` step uses `continue-on-error: true` so a doctor failure does
      not skip the comment step.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- **Triggers**: `pull_request` targeting the default branch, with a `paths`
  filter that includes `.ai/kenkeep/**`. Keep it generic; an inline comment notes
  consumers may widen/narrow the filter.
- **Runner**: `ubuntu-latest`.
- **Checkout**: `actions/checkout@v5` with `fetch-depth: 0` (mandatory for
  `freshness`; an inline comment explains the shallow-checkout degradation).
- **Node**: `actions/setup-node@v5`, `node-version: 'lts/*'`, `cache: 'npm'`.
  Inline comment notes consumers without a `package-lock.json` should drop the
  `cache` key.
- **No `npm ci` / no build of kenkeep itself**: invoke the published package via
  `npx --yes kenkeep ...`.
- **Steps** (each `--verbose`, output captured to a shared file or step output
  so the comment step can read it):
  1. `npx --yes kenkeep lint --verbose` — exit 1 fails the job (errors only).
  2. `npx --yes kenkeep doctor --verbose` — `continue-on-error: true`; hard
     errors are captured, warnings (harness-install, staleness, freshness) are
     captured verbatim. The comment body labels this section as "may include
     expected harness-install warnings in CI".
  3. `npx --yes kenkeep freshness --verbose` — always exits 0; output captured.
  4. **Drift-catcher**: `npx --yes kenkeep index rebuild && git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md`.
     The regeneration is local computation in the CI workspace; `git diff
     --exit-code` is the read-only verifier (exit 1 = drift). Inline comment
     states explicitly: never staged, never committed, never writes to `nodes/`.
  5. **Comment step**: `peter-evans/find-comment@v3` (or current major) to
     locate a prior comment whose body includes the stable marker
     `<!-- kenkeep-check -->`, then `peter-evans/create-or-update-comment@v3`
     (or current major) to create/update. The comment body:
     - opens with `<!-- kenkeep-check -->`;
     - one section per command with its exit status and a trimmed/truncated
       capture (per-section cap, long output wrapped in `<details>`);
     - ends with the remediation nudge: "Run `/kk-curate` to process accumulated
       session captures, or `kenkeep index rebuild` locally and commit the
       regenerated `ENTRY.md`/`GRAPH.md`.";
     - on zero findings, posts a "✅ KB health: all checks pass" message (and
       links to the workflow run for full output).
- **Permissions**: `contents: read`, `pull-requests: write`. No `id-token`, no
  secrets, no `packages`.
- **Concurrency** (optional): a `concurrency` group keyed on PR to cancel
  superseded runs; documented as optional via an inline comment.

## Input Dependencies

None — this task authors the canonical artifact from the plan spec.

## Output Artifacts

- `examples/kenkeep-check.yml` at repo root (the first file under the new
  `examples/` directory). Consumed by Task 2 (docs page) and by the plan's Self
  Validation steps.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

The plan (section "Component: `examples/kenkeep-check.yml`") is the authoritative
spec. Match the existing repo workflow style: see `.github/workflows/test.yml`
for the `actions/checkout@v5` + `setup-node@v5` + `cache: 'npm'` idiom, and
`.github/workflows/host-drift.yml` for a second reference. Key divergences from
`test.yml`: this example uses `fetch-depth: 0` (freshness needs full history),
does NOT run `npm ci`/`npm run build` (it consumes the published `kenkeep`
package via `npx`), and adds the PR-comment pair.

For output capture, the simplest robust pattern is to redirect each command's
stdout+stderr to a file under `$RUNNER_TEMP` (e.g.
`$RUNNER_TEMP/lint.txt`, `$RUNNER_TEMP/doctor.txt`, etc.) using `2>&1 | tee`, and
have the comment step read those files. Alternatively, use step outputs via
`$GITHUB_OUTPUT`. The file approach is more resilient to large output.

Pin `peter-evans/find-comment` and `peter-evans/create-or-update-comment` to a
major version (the plan mentions `v3`/`v5` as examples; use the latest stable
major — `v3` for both is the safest widely-available pin as of writing; verify
the major exists before pinning). Use `body-includes: "<!-- kenkeep-check -->"`
on `find-comment` to match the marker.

For the drift-catcher, the exact command sequence is:
`npx --yes kenkeep index rebuild && git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md`
— `&&` so a failed rebuild fails the step before `git diff`; `git diff
--exit-code` returns 1 on any diff, which is the drift signal. Set
`continue-on-error: true` is NOT appropriate here for the default config (drift
should fail the job) — but capture the result for the comment regardless. A
pragmatic pattern: run the drift step with `id: drift` and `if: always()` after
the lint step, then in the comment step read `steps.drift.outcome`.

The comment step should run `if: always()` (so it posts even when lint/doctor
fail) and use `github.event.pull_request.number` as the `issue-number`.

Do NOT add `peter-evans/create-pull-request` — the workflow only comments, never
opens PRs (out of scope, and constitution-adjacent).

</details>
