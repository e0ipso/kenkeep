# @e0ipso/ai-knowledge-base

[![npm](https://img.shields.io/npm/v/@e0ipso/ai-knowledge-base.svg)](https://www.npmjs.com/package/@e0ipso/ai-knowledge-base)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build and maintain a per-repo knowledge base from AI coding sessions, for use with [Claude Code](https://docs.claude.com/en/docs/claude-code), [OpenAI Codex CLI](https://developers.openai.com/codex/cli/), or [OpenCode](https://opencode.ai/).

Your AI sessions produce a steady stream of project-specific knowledge - conventions, prohibitions, gotchas, named modules, decision rationale. Today, almost all of it evaporates when the session ends. This tool captures it, asks a human to curate it, and injects it back into every future session so the harness starts each conversation with your team's accumulated context.

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --harnesses claude
npx @e0ipso/ai-knowledge-base doctor
```

For OpenAI Codex CLI, install with `npx @e0ipso/ai-knowledge-base init --harnesses codex`; Codex skills install under `.agents/skills/`. For OpenCode, install with `npx @e0ipso/ai-knowledge-base init --harnesses opencode`; OpenCode ships a single TS plugin shim at `.opencode/plugins/kb.mjs` plus per-event Node scripts under `.opencode/kb-hooks/`, and skills install under `.opencode/skills/`. All three harnesses share the same SKILL.md source; the active harness is resolved at runtime from inside each skill via a small `/tmp/kb-detect-harness.mjs` helper that the skill body materializes on first use.

That's the consumer path. After running `init`, AI sessions in this repo automatically capture candidate knowledge; `npx @e0ipso/ai-knowledge-base curate` (or `/kb-curate` from inside a session) writes new knowledge nodes directly under `nodes/`. You review with `git diff`, accept with `git commit`, reject with `git restore`.

If your repo already has READMEs, ADRs, and module docs, seed the KB from them:

```sh
# In a Claude Code session:
/kb-bootstrap

# Later, after adding more docs:
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/
```

## How it works (one paragraph)

Two cooperating pieces. The **builder tool** (this npm package) installs hooks under `.claude/` and a knowledge directory under `.ai/knowledge-base/`. Hooks capture redacted session slices, an async proposal extractor turns them into structured candidates, and the curator writes new knowledge nodes directly under `nodes/`. You review the diff and commit (or restore) like any other code change; a pre-commit hook keeps `INDEX.md`/`GRAPH.md` in lockstep. A `SessionStart` hook injects the current `INDEX.md` into every new AI session. The KB itself is plain markdown - readable, diffable, reviewable like code.

## CLI reference

### `npx @e0ipso/ai-knowledge-base lint`

Runs four mechanical, no-LLM checks against `nodes/`:

1. **Dangling structured edges**: any `relates_to` or `depends_on` reference that does not resolve to a node id is reported as an error.
2. **Slug / id naming**: every node's `id` must equal `<kind>-<slug>`, and the filename must be `<id>.md` under `nodes/<kind>/`. Mismatches are errors.
3. **Tag near-duplicates**: tags that normalize to the same form (case-folded, separator-stripped, single trailing-`s` stripped) are clustered and reported as findings when two or more variants exist.
4. **Orphans**: nodes that neither reference nor are referenced by another node are reported as findings.

Errors cause exit code 1; findings do not. Pass `--verbose` for a per-entry breakdown.

The lint also runs automatically every `lintEveryNSessions` sessions (default 50, configurable in `config.yaml`) via a SessionEnd async hook. The summary surfaces at the next SessionStart as a single nudge line; running the CLI clears it.

`doctor` checks install health (Node version, `claude` on PATH, hook wiring, INDEX freshness); `lint` checks content health (graph integrity, naming, tag hygiene, orphans).

### Conflicts

When the curator detects that a candidate contradicts an existing node, it writes one markdown file per conflict under `.ai/knowledge-base/conflicts/<id>.md`. Review each file with `git diff`, accept the proposed replacement with `git commit`, and reject it with `git restore`.

### Secret scanning in CI

This package does not install a commit-time secret scanner into your repo. Run `secretlint` in CI instead:

```yaml
# .github/workflows/secret-scan.yml
name: secret-scan
on: [pull_request, push]
jobs:
  secretlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx secretlint "**/*"
```

## Documentation

Full documentation lives at the docs site: [How it works](docs/how-it-works.md), [Installation](docs/installation.md), [Daily use](docs/daily-use.md), [CLI reference](docs/cli-reference.md), [Troubleshooting](docs/troubleshooting.md).

For maintainers of this package itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
