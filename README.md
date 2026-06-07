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

Coding assistants forget about everything in past sessions. Kenkeep creates a system that **salvages the gold nuggets in your past conversations**, and discards the rest. This way, the assistant can use that important detail you shared two weeks ago, without you even worrying about it.

Kenkeep is a **team-shared, git-native knowledge base** for AI coding assistants.

Your AI conversations produce a steady stream of project-specific knowledge (conventions, gotchas, named modules, decision rationale), and most of it evaporates when the session ends. This tool captures it, asks a human to curate it, commits it to the repo, and injects it back into every future session.

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

kenkeep runs a loop around your AI sessions. Capture and recall happen on their own; you trigger curation, and you decide what to keep:

- **Capture** (automatic): when a session ends, a hook saves the transcript.
- **Curate** (you run `/kk-curate`): the AI drafts proposed notes under `nodes/`, then walks you through any contradictions with an existing note.
- **Review** (you decide): inspect the notes with `git diff`, then commit the ones you want to keep.
- **Recall** (automatic): at the start of every session a hook injects only the root index; the assistant descends by relevance, opening just the notes it needs (**progressive disclosure**), so the payload stays small as the base grows.

<p align="center">
  <img src="docs/assets/images/progressive-disclosure.png" alt="kenkeep progressive disclosure: load the root index node, select relevant branches by intent and tags, descend into those branch indexes, then open only the confirmed-relevant leaf nodes and follow their cross-edges" width="100%">
</p>

Full walkthrough: [How it works](https://mateuaguilo.com/kenkeep/how-it-works.html).

## Quick start

```sh
npx kenkeep init --harnesses claude
npx kenkeep doctor
```

Swap `claude` for `codex`, `cursor`, `opencode`, or `copilot` (or pass a comma-separated list). For GitHub Copilot CLI, `npx kenkeep init --harnesses copilot` installs the skills under `.github/skills/` (Copilot's documented project skill location) and keeps the adapter's hook scripts under the project-local `.copilot/` directory, registering them in the user-level `~/.copilot/hooks/kk.json`.

Then code normally. When you want to turn captured material into knowledge nodes, run `/kk-curate` inside your harness session (also `/kk-add`, `/kk-bootstrap`). The skills are context-aware and walk you through conflict resolution. New nodes appear in `nodes/`; review with `git diff` and commit the ones you want to keep.

<table>
<tr>
<td width="50%" valign="top">

<img src="docs/assets/icons/sprout.svg" width="28" height="28" alt="" />

### Seed from existing docs

If your repo already has READMEs, ADRs, or module docs, seed the knowledge base from them. Inside a harness session:

```
/kk-bootstrap
```

The scan walks the repo root, filtered by `.kkignore` (generated by `init`, uses [gitignore-style syntax](https://git-scm.com/docs/gitignore)). Edit `.kkignore` to exclude directories you don't want scanned. Review the resulting nodes under `nodes/` with `git diff` and commit the ones you want to keep.

</td>
<td width="50%" valign="top">

<img src="docs/assets/icons/message-square-plus.svg" width="28" height="28" alt="" />

### Add knowledge manually

At any time during a session you can use `/kk-add` to make sure the assistant remembers a message. Just casually mention it, and you're done:

Example:

```
No, you got that wrong.

This project aims to maximize code
re-use, instead of duplication. Adapt
and extend the abstractions to fit
this use case. Also, /kk-add this.
```

</td>
</tr>
</table>

## Documentation

Full documentation: **<https://mateuaguilo.com/kenkeep>**

For maintainers of this package itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
