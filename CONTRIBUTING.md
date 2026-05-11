# Contributing to @e0ipso/ai-knowledge-base

Thanks for considering a contribution. This document is for maintainers and contributors to the npm package itself, not for end users of the tool. End-user docs live on the [docs site](docs/).

## Dev environment

Prerequisites:

- Node 22+
- npm 10+ (or pnpm 9+)
- Claude Code CLI on PATH for integration smoke tests (`claude --version`)
- [`gitleaks`](https://github.com/gitleaks/gitleaks) and [`pre-commit`](https://pre-commit.com) on PATH for the secret-scan tests

Set up:

```sh
git clone git@github.com:e0ipso/ai-knowledge-base.git
cd ai-knowledge-base
npm install
npm run build
```

`npm install` runs `prepare`, which builds templates and the CLI. After build, `node dist/cli.js --help` should work from the repo root.

## Project layout

```
src/
  cli.ts                          # commander entry, registers subcommands
  commands/                       # one file per subcommand (init, doctor, status, ...)
  adapters/
    types.ts                      # assistant-agnostic adapter contract
    claude.ts                     # Claude Code adapter implementation
  lib/                            # shared utilities (paths, log, version, ...)
  templates-source/               # source for the shipped templates/ directory
scripts/
  build-templates.mjs             # copies templates-source/ → templates/
templates/                        # built; bundled into the npm package
tests/
  fixtures/                       # transcripts and bootstrap docs used by integration tests
docs/                             # Jekyll/Just-the-Docs site, served via GitHub Pages
PRD.md                            # product requirements (authoritative)
IMPLEMENTATION.md                 # technical design (authoritative)
```

## Running tests

```sh
npm test               # unit + integration with mocked `claude` subprocess
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format:check   # prettier
```

### Real-`claude` E2E suite

The optional real-`claude` suite under `tests/e2e/` is gated behind `KB_RUN_REAL_CLAUDE=1`. When the env var is unset (the default) every spec is skipped, so `npm test` stays cheap and deterministic. When set, the suite spawns the actual `claude -p` CLI for stage-2 extraction and curation against a fixture transcript and asserts that the full cycle produces a node and a populated `INDEX.md`.

```sh
# Local invocation (requires `claude` on PATH, authenticated):
KB_RUN_REAL_CLAUDE=1 npx vitest run tests/e2e
```

Per-stage timeout is 5 minutes; the full suite typically finishes in 2–4 minutes when nothing is wrong.

CI does not run the E2E suite on every PR. Trigger it manually via the **E2E (real-claude)** workflow in GitHub Actions (`workflow_dispatch`). The job needs:

- `ANTHROPIC_API_KEY` repository secret (the workflow installs the Claude Code CLI globally; in CI it authenticates via env var, not OAuth).
- A reason for the run, surfaced as a `workflow_dispatch` input for the audit trail.

Run it on demand when:

- Changing a prompt template (`src/templates-source/prompts/*.md`).
- Touching `src/lib/headless.ts` or the `claude -p` subprocess flags.
- Bumping the pinned Claude Code CLI version.

The suite asserts on a stable project-unique substring from the fixture transcript ("Bravo Insider") so that minor wording drift between Claude model versions doesn't break it. If the assertion regresses, inspect the JSONL log under the temp sandbox's `_logs/stage-2/` and `_logs/curator/` to see exactly what the model produced.

### Manual test plan

Before a significant release — schema bump, capture/curate/consume behavior change, pinned Claude Code CLI bump — work through [`docs/manual-test-plan.md`](docs/manual-test-plan.md). It covers the checks that resist automation: per-platform smoke (macOS / Linux / WSL2 / native Windows), PreCompact timing on long sessions, real capture quality, `init --upgrade` from the previous published version, concurrent-pipeline locking, and a few intentionally-broken-state doctor exit-code checks. Record results in the release PR description.

## Schema-version bump policy

Every frontmatter and JSON state file in the system carries `schema_version: 1`. The policy is **moderate**: tools that read v1 must tolerate unknown additive fields without bumping, but renames/removals/semantic-shifts get an explicit migration boundary.

Concretely:

- **Bump `schema_version: 1 → 2`** when: removing a field; renaming a field; changing the semantics of a field (e.g. changing `kind` from string to enum-with-different-values); making a previously-optional field required.
- **Do not bump** when: adding an optional field; adding a new enum case; relaxing a constraint.

When you bump, ship a migrator in the same PR.

## Prompt versioning

Each `src/templates-source/prompts/*.md` and `src/templates-source/claude/commands/*.md` carries a top-of-file `Version: N` comment. Bump the version when you change behavior. Prompt version is independent of the npm package version, but a prompt change must be noted in the changelog so users know to inspect the diff.

## Release process

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/). Conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) determine the next version and changelog entry. Merging to `main` triggers the release pipeline; no manual tagging or `npm publish` is needed.

## Docs site preview

The docs site is Jekyll under `docs/`. To preview locally:

```sh
cd docs
bundle install
bundle exec jekyll serve
```

CI deploys on push to `main`.

## Submitting a PR

- One logical change per PR. Branch from `main`.
- Include doc updates for the phase you're touching (see IMPLEMENTATION.md §15.5 for the per-phase doc distribution).
- Run `npm test`, `npm run typecheck`, and `npm run lint` before pushing.
- Conventional commit format on commit messages and the PR title.
