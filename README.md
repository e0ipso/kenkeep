# @e0ipso/ai-knowledge-base

[![npm](https://img.shields.io/npm/v/@e0ipso/ai-knowledge-base.svg)](https://www.npmjs.com/package/@e0ipso/ai-knowledge-base)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build and maintain a per-repo knowledge base from AI coding sessions, for use with [Claude Code](https://docs.claude.com/en/docs/claude-code).

Your AI sessions produce a steady stream of project-specific knowledge — conventions, prohibitions, gotchas, named modules, decision rationale. Today, almost all of it evaporates when the session ends. This tool captures it, asks a human to curate it, and injects it back into every future session so the assistant starts each conversation with your team's accumulated context.

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
ai-knowledge-base doctor
```

That's the consumer path. After running `init`, AI sessions in this repo automatically capture candidate knowledge; `ai-knowledge-base curate` (or `/kb-curate` from inside a session) writes new knowledge nodes directly under `nodes/`. You review with `git diff`, accept with `git commit`, reject with `git restore`.

If your repo already has READMEs, ADRs, and module docs, seed the KB from them:

```sh
# In a Claude Code session:
/kb-bootstrap

# Later, after adding more docs:
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/
```

## How it works (one paragraph)

Two cooperating pieces. The **builder tool** (this npm package) installs hooks under `.claude/` and a knowledge directory under `.ai/knowledge-base/`. Hooks capture redacted session slices, an async stage-2 extractor turns them into structured candidates, and the curator writes new knowledge nodes directly under `nodes/`. You review the diff and commit (or restore) like any other code change; a pre-commit hook keeps `INDEX.md`/`GRAPH.md` in lockstep. A `SessionStart` hook injects the current `INDEX.md` into every new AI session. The KB itself is plain markdown — readable, diffable, reviewable like code.

## Documentation

Full documentation lives at the docs site: [How it works](docs/how-it-works.md), [Installation](docs/installation.md), [Daily use](docs/daily-use.md), [CLI reference](docs/cli-reference.md), [Troubleshooting](docs/troubleshooting.md).

For maintainers of this package itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
