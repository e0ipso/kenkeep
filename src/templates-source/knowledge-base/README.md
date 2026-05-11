# Project knowledge base

This directory holds the project's AI-session-derived knowledge base. It is built and maintained by [`@e0ipso/ai-knowledge-base`](https://github.com/e0ipso/ai-knowledge-base). Everything inside it is plain markdown — you can read it in any editor or on the GitHub web UI.

## What this is

When you (or a teammate) run an AI coding session against this repo, the tool watches the session and extracts candidate knowledge — project conventions, prohibitions, named modules and features, gotchas. Those candidates are reviewed by a human and committed to this directory as knowledge nodes. A `SessionStart` hook injects a token-budgeted index of these nodes into every new AI session, so the assistant starts each conversation with the project's accumulated context.

## How knowledge gets here

1. **Capture.** During an AI session, a hook records redacted slices of the transcript to `_sessions/`.
2. **Curate.** When enough sessions accumulate, you run `/kb-curate` (or `ai-knowledge-base curate`). The curator reads pending sessions, compares them against existing nodes, and writes proposals to `_proposed/`.
3. **Review.** Proposals show up as files you can read like any code change. Accept by moving the file into `nodes/`, reject by deleting it.
4. **Consume.** Every future session sees the new node in its injected index.

## How to read a node

Each `.md` file in `nodes/` has a frontmatter header and a markdown body. Key fields:

- `kind`: `practice` (how we build things — conventions, prohibitions, gotchas) or `map` (what exists in the project — features, vocabulary, locations).
- `valid_from` / `valid_until`: the temporal window during which the fact is considered current. `valid_until: null` means still valid.
- `superseded_by` / `supersedes`: when a decision is reversed, the old node stays in place with `valid_until` set and links to the new node.
- `derived_from`: list of session log filenames that produced or refined this node. (Note: `_sessions/` is gitignored by default, so provenance only resolves for the original contributor unless your team commits it.)

## Manually adding a node

Two paths, both human-in-the-loop:

- From the terminal: `npx @e0ipso/ai-knowledge-base node add` (interactive prompts).
- From inside a Claude Code session: `/kb-add`.

Either way the result lands in `_proposed/additions/`, never directly in `nodes/`.

## Bootstrap from existing docs

If your repo already has READMEs, ADRs, and module docs, you can seed the KB from them with `/kb-bootstrap` (a one-time, supervised pass) or `npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/` (for picking up new or changed docs later).

## Subdirectories

- `nodes/` — accepted knowledge nodes, organized by kind (`practice/`, `map/`).
- `_proposed/` — pending changes awaiting human review (`additions/`, `modifications/`, `contradictions/`).
- `_sessions/` — raw captured transcripts (gitignored by default).
- `_logs/` — stream-json traces from LLM-driven runs (gitignored).
- `INDEX.md` — token-budgeted summary; injected into every new session.
- `GRAPH.md` — full edge listing of nodes; available for the assistant to read on demand.

## Learn more

See the [docs site](https://github.com/e0ipso/ai-knowledge-base) for the full reference, troubleshooting guide, and architecture overview.
