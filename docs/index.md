---
title: Home
layout: home
nav_order: 1
redirect_from:
  - /why-kenkeep.html
---

# kenkeep

<p align="center">
  <img src="{{ '/assets/images/kenkeep-hero.png' | relative_url }}" alt="kenkeep: AI coding sessions are curated into a reviewed, git-tracked knowledge library" />
</p>

Coding assistants forget everything between sessions. Kenkeep **salvages the gold nuggets from your past conversations** and discards the rest, so the detail you explained two weeks ago is there the next time the assistant needs it.

Kenkeep is a **team-shared, git-native knowledge base** for AI coding assistants. Conventions, gotchas, module names, and the reasons behind decisions get captured from your sessions, curated by a human, committed to the repo, and injected back into every future session.

## Overview

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;margin-top:1rem;">
<div>
<a href="{{ '/assets/images/kenkeep-slide-01.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-01.png' | relative_url }}" alt="Your AI sessions have value. Don't lose it." />
</a>
</div>
<div>
<a href="{{ '/assets/images/kenkeep-slide-02.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-02.png' | relative_url }}" alt="How Kenkeep captures knowledge in three simple ways." />
</a>
</div>
<div>
<a href="{{ '/assets/images/kenkeep-slide-03.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-03.png' | relative_url }}" alt="Right knowledge at the right time through progressive disclosure." />
</a>
</div>
<div>
<a href="{{ '/assets/images/kenkeep-slide-04.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-04.png' | relative_url }}" alt="Why teams love Kenkeep." />
</a>
</div>
<div>
<a href="{{ '/assets/images/kenkeep-slide-05.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-05.png' | relative_url }}" alt="Privacy-first and open-source." />
</a>
</div>
<div>
<a href="{{ '/assets/images/kenkeep-slide-06.png' | relative_url }}">
<img src="{{ '/assets/images/kenkeep-slide-06.png' | relative_url }}" alt="Turn AI interactions into long-term advantage." />
</a>
</div>
</div>

## Why kenkeep?

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;margin-top:1rem;">
<div>
<img src="{{ '/assets/icons/users.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>Built up and shared across your team</h3>
<p>One markdown file per fact, accumulated from real coding sessions and stored in your repo. It travels with <code>git pull</code>, so every teammate works from the same conventions instead of rediscovering them alone.</p>
</div>
<div>
<img src="{{ '/assets/icons/git-pull-request.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>Reviewed and versioned like code</h3>
<p>Nothing reaches the knowledge base without a human approving it. Every addition is an ordinary git diff you review in a commit or PR, with the full history there to blame or revert.</p>
</div>
<div>
<img src="{{ '/assets/icons/server-off.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>No extra infrastructure</h3>
<p>No daemons, services, databases, or vector stores. Kenkeep is Node and git. Nothing to provision, host, keep alive, or secure.</p>
</div>
<div>
<img src="{{ '/assets/icons/key-round.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>No API keys</h3>
<p>It runs inside the assistant you already pay for: Claude Code, Codex, Cursor, OpenCode, or Copilot. There is no separate key to obtain, store, or rotate.</p>
</div>
</div>

### How it compares

Most memory tools are solo, living on one machine for one user, or heavy, needing a daemon, a database, or an API key.

| | Storage | Shared | Review gate | Runs on |
|---|---|---|---|---|
| [claude-mem](https://github.com/thedotmack/claude-mem) | SQLite and ChromaDB, per user | No | None | A Bun worker plus Python |
| Claude Code auto-memory | Markdown under `~/.claude/` | No | None | Claude Code only |
| mem0, Letta, Zep | Vector or graph database | Via a service | None | A database and an embedding API |
| Cursor rules, `AGENTS.md` | Committed markdown | Via git | Hand edits | Nothing extra |
| **kenkeep** | **Committed markdown** | **Via git pull** | **Every note is a commit** | **Node 22 and git** |

Code-documentation generators answer "what is this code?". Kenkeep answers "what do we know about working here that the code does not say?". Run both if you like.

Kenkeep has no memory across repos, no semantic search, and no unattended curation. Knowledge lands only when someone runs `/kk-curate` and commits.

## Quick start

```sh
npx kenkeep init --harnesses claude
npx kenkeep doctor
```

Swap `claude` for `codex`, `cursor`, `opencode`, or `copilot`, or pass a comma-separated list.

Then code as usual. When the assistant nudges you, run `/kk-curate` in your session. New notes land under `.ai/kenkeep/nodes/`. Review them with `git diff` and commit the ones you want to keep.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;margin-top:1rem;">
<div>
<img src="{{ '/assets/icons/sprout.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>Seed from existing docs</h3>
<p>If your repo already has READMEs, ADRs, or module docs, seed the knowledge base from them. Inside a session:</p>
<pre><code>/kk-bootstrap</code></pre>
<p>The scan starts at the repo root and honors <code>.kkignore</code>, which <code>init</code> creates with <a href="https://git-scm.com/docs/gitignore">gitignore syntax</a>. Review the resulting notes with <code>git diff</code> and commit the ones you want.</p>
</div>
<div>
<img src="{{ '/assets/icons/message-square-plus.svg' | relative_url }}" width="28" height="28" alt="" />
<h3>Add knowledge manually</h3>
<p>Mid-session, mention <code>/kk-add</code> and the assistant records the point you just made:</p>
<pre><code>No, you got that wrong.

This project aims to maximize code
re-use, instead of duplication. Adapt
and extend the abstractions to fit
this use case. Also, /kk-add this.</code></pre>
</div>
</div>

## How it works

Capture and recall are automatic. Curating and committing are yours.

<p align="center">
  <img src="{{ '/assets/images/kenkeep-infography.png' | relative_url }}" alt="kenkeep knowledge lifecycle: capture transcripts, curate them into reviewed notes, and inject them back into every session" />
</p>

## Read next

- **[How it works](how-it-works.md)**, the three-minute version.
- **[Installation](installation.md)**, per-harness setup, configuration, and CI.
- **[Daily use](daily-use.md)**, the loop you run week to week.
- **[Knowledge packs](knowledge-packs.md)**, import and publish portable knowledge bases.
- **[Troubleshooting](troubleshooting.md)**, when something looks wrong.
- **[Internals](internals/)**, for contributors.
