# Contributing to kenkeep

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
git clone git@github.com:e0ipso/kenkeep.git
cd kenkeep
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
    cursor/                       # Cursor agent adapter
    opencode/                     # OpenCode adapter (TS plugin + per-event kk-hooks)
    copilot/                      # GitHub Copilot CLI adapter (per-event JSON hooks + kk-hooks)
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

Before a significant release (schema bump, capture/curate/consume behavior change, pinned Claude Code CLI bump), run these checks and record the results in the release PR. They cover what automation cannot: real sessions, other operating systems, and judgment about capture quality.

Sandbox: `git init` an empty directory, `npm pack` the candidate build, run `npx ./e0ipso-kenkeep-<v>.tgz init --harnesses claude`, then `npx kenkeep doctor` (exit 0, warnings allowed).

1. **Platform smoke.** On macOS, Linux, WSL2, and native Windows: one `Stop` capture produces one `_sessions/` log with `proposal_status: pending`. On Windows, hook scripts must be LF and commands must use forward slashes.
2. **PreCompact timing.** Drive a session past auto-compact. Capture adds under 1 s, and the log holds the full transcript slice, not a summary. `time node .ai/kenkeep/hooks/claude/kk-capture.cjs < /dev/null` should stay under 200 ms cold.
3. **End-to-end.** Ten to fifteen substantive messages, end the session, open a new one, run `/kk-curate`. Expect one to four nodes, and judge whether they are the right facts (target 80 percent acceptance). Commit some, `git restore` the rest, run `index rebuild`, then ask the assistant what it knows about the project.
4. **`init --upgrade`.** From the last published version with an edited `proposal-extract.md` and a custom `config.yaml` key: the edit and the key survive, hook scripts and `installed-version` show the new version, `doctor` exits 0.
5. **`logs prune`.** Backdate one JSONL with `touch -d "60 days ago"`. Prune deletes it and nothing newer. `logsRetentionDays: 0` deletes everything; a second run reports zero.
6. **`/kk-bootstrap`.** On a small public repo, nodes land in topical folders, the summary lists skipped collisions, and no node carries a secret or a stale TODO. Re-running skips every unchanged doc by hash and reprocesses only an edited one.
7. **Concurrency.** Two parallel `curate` launchers both finish without a lock error, `state.json` and every session log still parse, and unstamped sessions reprocess on the next run. Two rapid `SessionStart` drains: the second skips while the first holds the lock, and a killed drain's lock is reclaimed within about a minute.
8. **Settings.** No `config.yaml` uses the defaults. `curationThreshold: 3` is honored. An unknown key fails with an error naming the file.
9. **Doctor exit codes.** Deleted `installed-version` is an error (exit 1). A dangling `kk_derived_from`, a hand-edited node after curate, or a version mismatch each warn (exit 0).

If a manual check finds a regression automation should have caught, add the missing test in the fix PR.

### Prompt evaluation

Run this before bumping the `Version:` of `src/templates-source/prompts/proposal-extract.md` or `knowledge-admission.md`:

```sh
npm run prompt-eval -- --harness <id>
```

It runs one headless call per fixture in `tests/fixtures/prompt-eval/` through the selected adapter (24 generation calls plus up to 13 judge calls, two at a time), validates every result against the schema, and prints a Markdown report with recall, phantom count, and gate accuracy per category. Score failures are advisory. A nonzero exit means the run itself was incomplete. Use `--runs 3` to expose variance, and `--concurrency` or `--timeout-ms` to tune the pool. Paste the report into the PR and compare it with the previous report on the same harness and model. Artifacts land under `.ai/kenkeep/.state/prompt-eval/` and must not be committed.

## Schema-version bump policy

Every frontmatter and JSON state file in the system carries a `schema_version`. The policy is **strict**: any breaking change to the on-disk shape gets a clean break - no compatibility shims and no legacy code paths in the readers. The reader rejects the old shape and users on it re-initialize.

Concretely:

- **Bump `schema_version`** when: removing a field; renaming a field; changing the semantics of a field; making a previously-optional field required.
- **Do not bump** when: adding an optional field; adding a new enum case; relaxing a constraint.

When you bump, the reader rejects older files with a clear error directing the user to run the `kk-migrate` skill in their agent session (migration requires an interactive session; re-running `init` does not migrate existing nodes).

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

A "harness" is one of the assistant CLIs we drive (Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot CLI, ...). Each harness lives under `src/harnesses/<id>/` and ships as a `HarnessAdapter` implementation. Codex and Cursor are the shell-hook reference adapters (`.codex/hooks.json` and `.cursor/hooks.json`); OpenCode uses a plugin shim; Copilot uses a per-event JSON hook document (`.github/hooks/kk.json`, repo-level). To wire up a new one (call it `<id>`):

1. **Implement `HarnessAdapter`.** The interface lives in [`src/harnesses/types.ts`](src/harnesses/types.ts). Provide `id`, `hooks`, `paths`, `install`, `upgrade`, `parseTranscript`, `renderTranscript`, `runHeadless`, `buildHarnessOpts`, `doctorChecks`, and (optionally) `detectFromEnv`.
2. **Declare your event vocabulary.** `HookEvent` is opaque `string`; each adapter declares the event names its host runtime actually emits (Claude uses `Stop`/`SessionEnd`/...; Codex reuses Claude names; OpenCode uses `session.idle`/`session.created`). Pick whatever names the runtime exposes natively; do not translate to a global enum.
3. **Choose `hooksDir` or `pluginsDir` in `paths(root)`.** Adapters whose host runtime fires per-event shell commands use `hooksDir`. Adapters whose host runtime expects a long-lived plugin module subscribed to an event bus (OpenCode) use `pluginsDir` instead; the build pipeline auto-detects a sibling `src/harnesses/<id>/plugins/` directory and emits its TS sources to `templates/<id>/plugins/`, plus renames the hook output to `kk-hooks/` (so `.opencode/kk-hooks/` does not collide with the runtime-reserved `.opencode/hooks/`). When your adapter has no plugin shim but still needs its hook scripts kept apart from a `<dir>/hooks/` that holds a config artifact (Copilot stores `kk.json` there), drop an empty `src/harnesses/<id>/.kk-hooks-output` marker file: the build honors it the same way, emitting scripts to `templates/<id>/kk-hooks/`.

4. **Declare `payload` on `HookSpec` entries when the host hook-config schema needs per-entry metadata.** `HookSpec.payload` is an opaque `Record<string, unknown>` consumed only by your own adapter's `hooks-config` writer; shared code never reads it. Copilot uses it to carry the per-event `{ type, timeoutSec, env }` knobs its JSON hook format requires, and renders them into the native shape in `hooks-config.ts`. Adapters whose host needs no per-entry metadata leave it unset.
5. **Register the adapter.** Add it to the central registry in [`src/harnesses/registry.ts`](src/harnesses/registry.ts) so `--harness <id>` and the env detector pick it up. Add `<id>` to the `REGISTERED` allowlist in each `src/templates-source/skills/kk-*/SKILL.md` heredoc; `npm run lint:detect-harness` fails CI when the registry and heredocs disagree.
6. **Add hook scripts.** Place compiled-source hook scripts under `src/harnesses/<id>/hooks/` (one `.mjs` per hook). The build pipeline in `scripts/build-templates.mjs` auto-discovers them and emits them into the bundled `templates/<id>/hooks/` tree (or `kk-hooks/`, see step 3).
7. **Add templates.** Place static template assets (settings stubs, harness-specific config) under `src/templates-source/<id>/`. Skills are not per-harness: the shared `src/templates-source/skills/` tree installs identical SKILL.md bytes into every configured harness's native skills dir.
8. **Add doctor checks.** Implement harness-specific health probes (CLI on PATH, settings file validity, hook registration intact) in `src/harnesses/<id>/doctor.ts` and surface them via the adapter's `doctorChecks(paths)` method.
9. **Add a `ModelChoiceSchema` discriminator option.** The discriminated union in [`src/lib/schemas.ts`](src/lib/schemas.ts) keys per-call model selection on the `harness` field. Add a new schema variant (`{ harness: '<id>', ... }`) so `proposalModel`, `curatorModel`, and `bootstrapModel` accept your harness in `config.yaml`.
10. **Wire up env detection (if your runtime exports an in-session env var).** Add an env detector to the adapter's `detectFromEnv` AND to the heredoc inside `src/templates-source/skills/kk-curate/SKILL.md` (the `ENV_DETECTORS` array). Both lists must stay in sync; `npm run lint:detect-harness` fails CI on drift. Copilot exports no in-session env var, so it omits `detectFromEnv` and relies on `--harness` / `--hint` / `cliDefaultHarness`.
11. **Write tests.** Place unit and integration tests under `tests/harnesses/<id>/`. Cover at minimum: transcript parsing, hook registration round-trip, doctor checks, and headless-run option mapping.

Adapters never reach into each other's directories. Anything shared (paths under `.ai/kenkeep/`, the curator pipeline, the node schema, the secret scanner, the SKILL.md tree) lives in the harness-neutral modules under `src/lib/` or `src/commands/`, or under `src/templates-source/skills/`.

## Submitting a PR

- One logical change per PR. Branch from `main`.
- Include doc updates alongside the code change in the same PR.
- Run `npm test`, `npm run typecheck`, and `npm run lint` before pushing.
- Conventional commit format on commit messages and the PR title.
