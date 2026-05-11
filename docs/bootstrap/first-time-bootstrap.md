---
title: First-time bootstrap
parent: Bootstrap
nav_order: 1
---

# First-time bootstrap (`/kb-bootstrap`)

Run once when adopting the KB on a project that already has docs. Agent-driven, in-session, supervised. For deterministic re-runs after the first pass, use [incremental bootstrap](incremental-bootstrap.md).

## Usage

In a Claude Code session:

```
/kb-bootstrap            # default scan: docs/, root *.md
/kb-bootstrap docs/architecture
```

## What it does

1. Surveys the docs tree with `Glob`/`Grep` and reports its plan.
2. Reads entry points (top-level READMEs, index pages) first.
3. Skims long reference docs, follows cross-references.
4. Splits candidates: imperative content becomes practice proposals, named entities become map proposals.
5. Writes proposals to `_proposed/additions/` with `proposal.rationale: "bootstrap: <doc>"` and `derived_from: [<doc>]`. Confidence defaults to `medium`.
6. Records SHA-256 of every doc read into `.ai/knowledge-base/.state/bootstrap-state.json` so future incremental runs skip them.
7. Reports back: docs read, docs skipped, proposal counts, noted contradictions.

The agent never writes to `nodes/`, never auto-resolves contradictions, and stops to ask when uncertain or when the docs tree exceeds ~100 files.

After it finishes, run `ai-knowledge-base proposals review`.

## Customizing

The skill body is at `.claude/skills/kb-bootstrap/SKILL.md`. Edit like any project asset. The shipped copy lives at `templates/claude/skills/kb-bootstrap/` inside the npm package.
