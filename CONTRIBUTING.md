# Contributing to @e0ipso/ai-knowledge-base

Thanks for considering a contribution. This document is for maintainers and contributors to the npm package itself, not for end users of the tool. End-user docs live on the [docs site](docs/).

## Dev environment

Prerequisites:

- Node 22+
- npm 10+ (or pnpm 9+)
- Claude Code CLI on PATH for integration smoke tests (`claude --version`)
- No external binaries - the capture-hook secret scan runs [`secretlint`](https://github.com/secretlint/secretlint) programmatically from `node_modules`.

Git hooks are managed by [husky](https://typicode.github.io/husky/) and installed automatically by `npm install` (via the `prepare` script). The `pre-commit` hook runs [`lint-staged`](https://github.com/lint-staged/lint-staged), which in turn runs ESLint, Prettier, and secretlint on staged files, followed by `typecheck` and `test` across the project.

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
  harnesses/
    types.ts                      # harness-agnostic adapter contract
    registry.ts                   # central HarnessAdapter registry
    detect.ts                     # env-based active-harness resolver
    claude/                       # Claude Code adapter
    codex/                        # OpenAI Codex CLI adapter
    opencode/                     # OpenCode adapter (TS plugin + per-event kb-hooks)
  lib/                            # shared utilities (paths, log, version, schemas, ...)
  templates-source/               # source for the shipped templates/ directory
scripts/
  build-templates.mjs             # copies templates-source/ to templates/, builds hook scripts
templates/                        # built; bundled into the npm package
tests/
  fixtures/                       # transcripts and bootstrap docs used by integration tests
  harnesses/                      # per-adapter test suites
docs/                             # Jekyll/Just-the-Docs site, served via GitHub Pages
PRD.md                            # product requirements (authoritative)
```

## Running tests

```sh
npm test               # unit + integration with mocked `claude` subprocess
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format:check   # prettier
```

### Manual test plan

Before a significant release - schema bump, capture/curate/consume behavior change, pinned Claude Code CLI bump - work through [`docs/internals/manual-test-plan.md`](docs/internals/manual-test-plan.md). It covers the checks that resist automation: per-platform smoke (macOS / Linux / WSL2 / native Windows), PreCompact timing on long sessions, real capture quality, `init --upgrade` from the previous published version, concurrent-pipeline locking, and a few intentionally-broken-state doctor exit-code checks. Record results in the release PR description.

## Schema-version bump policy

Every frontmatter and JSON state file in the system carries `schema_version: 1`. The policy is **strict**: any breaking change to the on-disk shape gets a clean break - there are no migrators, no compatibility shims, and no legacy code paths. Users on the old shape re-initialize.

Concretely:

- **Bump `schema_version: 1 → 2`** when: removing a field; renaming a field; changing the semantics of a field; making a previously-optional field required.
- **Do not bump** when: adding an optional field; adding a new enum case; relaxing a constraint.

When you bump, the reader rejects v1 files with a clear error directing the user to re-run `init`. Do not write a migrator.

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

## Adding a new harness adapter

A "harness" is one of the assistant CLIs we drive (Claude Code, Codex CLI, OpenCode, ...). Each harness lives under `src/harnesses/<id>/` and ships as a `HarnessAdapter` implementation. To wire up a new one (call it `<id>`):

1. **Implement `HarnessAdapter`.** The interface lives in [`src/harnesses/types.ts`](src/harnesses/types.ts). Provide `id`, `hooks`, `paths`, `install`, `upgrade`, `parseTranscript`, `renderTranscript`, `runHeadless`, `buildHarnessOpts`, `doctorChecks`, and (optionally) `detectFromEnv`.
2. **Declare your event vocabulary.** `HookEvent` is opaque `string`; each adapter declares the event names its host runtime actually emits (Claude uses `Stop`/`SessionEnd`/...; Codex reuses Claude names; OpenCode uses `session.idle`/`session.created`). Pick whatever names the runtime exposes natively; do not translate to a global enum.
3. **Choose `hooksDir` or `pluginsDir` in `paths(root)`.** Adapters whose host runtime fires per-event shell commands use `hooksDir`. Adapters whose host runtime expects a long-lived plugin module subscribed to an event bus (OpenCode) use `pluginsDir` instead; the build pipeline auto-detects a sibling `src/harnesses/<id>/plugins/` directory and emits its TS sources to `templates/<id>/plugins/`, plus renames the hook output to `kb-hooks/` (so `.opencode/kb-hooks/` does not collide with the runtime-reserved `.opencode/hooks/`).
4. **Register the adapter.** Add it to the central registry in [`src/harnesses/registry.ts`](src/harnesses/registry.ts) so `--harness <id>` and the env detector pick it up.
5. **Add hook scripts.** Place compiled-source hook scripts under `src/harnesses/<id>/hooks/` (one `.mjs` per hook). The build pipeline in `scripts/build-templates.mjs` auto-discovers them and emits them into the bundled `templates/<id>/hooks/` tree (or `kb-hooks/`, see step 3).
6. **Add templates.** Place static template assets (settings stubs, harness-specific config) under `src/templates-source/<id>/`. Skills are not per-harness: the shared `src/templates-source/skills/` tree installs identical SKILL.md bytes into every configured harness's native skills dir.
7. **Add doctor checks.** Implement harness-specific health probes (CLI on PATH, settings file validity, hook registration intact) in `src/harnesses/<id>/doctor.ts` and surface them via the adapter's `doctorChecks(paths)` method.
8. **Add a `ModelChoiceSchema` discriminator option.** The discriminated union in [`src/lib/schemas.ts`](src/lib/schemas.ts) keys per-call model selection on the `harness` field. Add a new schema variant (`{ harness: '<id>', ... }`) so `proposalModel`, `curatorModel`, and `bootstrapModel` accept your harness in `config.yaml`.
9. **Wire up env detection (if your runtime exports an in-session env var).** Add an env detector to the adapter's `detectFromEnv` AND to the heredoc inside `src/templates-source/skills/kb-curate/SKILL.md` (the `ENV_DETECTORS` array). Both lists must stay in sync; `npm run lint:detect-harness` fails CI on drift.
10. **Write tests.** Place unit and integration tests under `tests/harnesses/<id>/`. Cover at minimum: transcript parsing, hook registration round-trip, doctor checks, and headless-run option mapping.

Adapters never reach into each other's directories. Anything shared (paths under `.ai/knowledge-base/`, the curator pipeline, the node schema, the secret scanner, the SKILL.md tree) lives in the harness-neutral modules under `src/lib/` or `src/commands/`, or under `src/templates-source/skills/`.

## Submitting a PR

- One logical change per PR. Branch from `main`.
- Include doc updates alongside the code change in the same PR.
- Run `npm test`, `npm run typecheck`, and `npm run lint` before pushing.
- Conventional commit format on commit messages and the PR title.
