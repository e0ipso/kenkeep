# @e0ipso/ai-knowledge-base

[![npm](https://img.shields.io/npm/v/@e0ipso/ai-knowledge-base.svg)](https://www.npmjs.com/package/@e0ipso/ai-knowledge-base)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A **team-shared, git-native knowledge base** for AI coding sessions on [Claude Code](https://docs.claude.com/en/docs/claude-code), [Codex CLI](https://developers.openai.com/codex/cli/), [Cursor](https://cursor.com/docs), and [OpenCode](https://opencode.ai/). Knowledge lives in your repo as plain markdown, not in a per-user database on one developer's laptop, so it propagates to teammates through `git pull` and is **reviewable like code** in PR diffs and commit history.

No daemons. No services. No external runtimes. Just Node + git.

Your AI conversations produce a steady stream of project-specific knowledge (conventions, gotchas, named modules, decision rationale), and most of it evaporates when the session ends. This tool captures it, asks a human to curate it, commits it to the repo, and injects it back into every future session.

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --harnesses claude
npx @e0ipso/ai-knowledge-base doctor
```

## Documentation

Full documentation: **<https://mateuaguilo.com/ai-knowledge-base>**

For maintainers of this package itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
