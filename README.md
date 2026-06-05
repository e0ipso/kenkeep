<p align="center">
  <img src="docs/assets/images/kenkeep-hero.png" alt="kenkeep: AI coding sessions are curated into a reviewed, git-tracked knowledge library" width="100%">
</p>

<h1 align="center">kenkeep</h1>

<p align="center">
  <strong>A team-shared, git-native knowledge base for AI coding sessions.</strong><br>
  Built up in your repo, reviewed and versioned like code, with no extra infrastructure to run.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/kenkeep"><img src="https://img.shields.io/npm/v/kenkeep?style=flat-square&label=npm&color=D14781&labelColor=2b2230" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/kenkeep"><img src="https://img.shields.io/npm/dm/kenkeep?style=flat-square&color=D14781&labelColor=2b2230" alt="npm downloads"></a>
  <a href="https://github.com/e0ipso/kenkeep/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/e0ipso/kenkeep/test.yml?style=flat-square&label=tests&color=D14781&labelColor=2b2230" alt="tests"></a>
  <a href="package.json"><img src="https://img.shields.io/node/v/kenkeep?style=flat-square&color=D14781&labelColor=2b2230" alt="node version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/kenkeep?style=flat-square&color=D14781&labelColor=2b2230" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://mateuaguilo.com/kenkeep/how-it-works.html">How it works</a> &nbsp;·&nbsp;
  <a href="https://mateuaguilo.com/kenkeep/installation.html">Installation</a> &nbsp;·&nbsp;
  <a href="https://mateuaguilo.com/kenkeep/daily-use.html">Daily use</a> &nbsp;·&nbsp;
  <a href="https://mateuaguilo.com/kenkeep/troubleshooting.html">Troubleshooting</a>
</p>

---

Coding assistants forget everything from past sessions. Your AI conversations produce a steady stream of project-specific knowledge (conventions, gotchas, named modules, decision rationale), and most of it evaporates when the session ends. kenkeep captures it, asks a human to curate it, commits it to the repo, and injects it back into every future session — on [Claude Code](https://docs.claude.com/en/docs/claude-code), [Codex CLI](https://developers.openai.com/codex/cli/), [Cursor](https://cursor.com/docs), [OpenCode](https://opencode.ai/), and [GitHub Copilot CLI](https://github.com/github/copilot-cli).

## Why kenkeep

<table>
<tr>
<td width="50%" valign="top">

<img src="docs/assets/icons/users.svg" width="28" height="28" alt="" />

### Built up and shared across your team

The knowledge base grows in your repo as plain markdown, one node per fact, accumulated from real coding sessions. It travels with the project through `git pull`, so every teammate works from the same conventions instead of rediscovering them on their own laptop.

</td>
<td width="50%" valign="top">

<img src="docs/assets/icons/git-pull-request.svg" width="28" height="28" alt="" />

### Reviewed and versioned like code

Nothing reaches the knowledge base without a human approving it. Every addition or change is an ordinary git diff you review in a commit or PR, with the full history there to inspect, blame, or revert like any other code.

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img src="docs/assets/icons/server-off.svg" width="28" height="28" alt="" />

### No extra infrastructure

No daemons, services, databases, or vector stores. kenkeep is just Node and git, so there is nothing to provision, host, or keep alive, and nothing new to secure.

</td>
<td width="50%" valign="top">

<img src="docs/assets/icons/key-round.svg" width="28" height="28" alt="" />

### No API keys

It all runs from within the assistant of your choice, on the subscription you already pay for. There is no separate API key to obtain, store, or rotate.

</td>
</tr>
</table>

## How it works

<p align="center">
  <img src="docs/assets/images/kenkeep-infography.png" alt="kenkeep knowledge lifecycle: capture transcripts, curate them into reviewed notes, and inject them back into every session" width="100%">
</p>

kenkeep runs a loop around your AI sessions:

- **Capture** (automatic): when a session ends, a hook saves the transcript.
- **Curate** (you run `/kk-curate`): the AI drafts proposed notes under `nodes/`, then walks you through any contradictions with an existing note.
- **Review** (you decide): inspect the notes with `git diff`, then commit the ones you want to keep. `INDEX.md` is injected into every future session.

Full walkthrough: [How it works](https://mateuaguilo.com/kenkeep/how-it-works.html).

## Quick start

```sh
npx kenkeep init --harnesses claude
npx kenkeep doctor
```

Swap `claude` for `codex`, `cursor`, `opencode`, or `copilot` (or pass a comma-separated list). For GitHub Copilot CLI, `npx kenkeep init --harnesses copilot` installs the skills under `.github/skills/` (Copilot's documented project skill location) and keeps the adapter's hook scripts under the project-local `.copilot/` directory, registering them in the user-level `~/.copilot/hooks/kk.json`.

Then code normally. When you want to turn captured material into knowledge nodes, run `/kk-curate` inside your harness session (also `/kk-add`, `/kk-bootstrap`). The skills are context-aware and walk you through conflict resolution. New nodes appear in `nodes/`; review with `git diff` and commit the ones you want to keep.

### Seed from existing docs

If your repo already has READMEs, ADRs, or module docs, seed the knowledge base from them. Inside a harness session:

```
/kk-bootstrap
```

The scan walks the repo root, filtered by `.kkignore` (generated by `init`, uses [gitignore-style syntax](https://git-scm.com/docs/gitignore)). Edit `.kkignore` to exclude directories you don't want scanned. Review the resulting nodes under `nodes/` with `git diff` and commit the ones you want to keep.

## Documentation

Full documentation: **<https://mateuaguilo.com/kenkeep>**

For maintainers of this package itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
