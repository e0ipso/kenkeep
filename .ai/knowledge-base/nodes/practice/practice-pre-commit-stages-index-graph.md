---
schema_version: 1
id: practice-pre-commit-stages-index-graph
title: "Pre-commit regenerates and stages INDEX.md and GRAPH.md"
kind: practice
tags: [pre-commit, index, graph, lint-staged]
derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - docs/cli-reference.md
relates_to:
  - map-index-md
  - map-graph-md
depends_on: []
confidence: high
summary: "Recommended lint-staged recipe runs `index rebuild --stage` when nodes/ changes, so the regenerated index lands in the same commit as the node change."
---

# Pre-commit regenerates and stages `INDEX.md` and `GRAPH.md`

When a project adopts the recommended lint-staged recipe, any commit that touches `.ai/knowledge-base/nodes/**/*.md` runs `npx @e0ipso/ai-knowledge-base index rebuild --stage`. That command regenerates the indices deterministically and runs `git add` so the new `INDEX.md` and `GRAPH.md` land in the same commit as the node change.

```js
// .lintstagedrc.cjs
module.exports = {
  '*': ['secretlint'],
  '.ai/knowledge-base/nodes/**/*.md': () => ['npx @e0ipso/ai-knowledge-base index rebuild --stage'],
};
```

**Why:** the injected `INDEX.md` is what every new session reads from the harness. If a contributor commits a node change without regenerating the index, the next session reads a stale catalog. Pre-commit staging makes drift structurally impossible for commits that go through the hook.

**How to apply:**

- `init` does **not** install husky / lint-staged / secretlint / commitlint. It's the consumer's job to wire those up (see `docs/installation.md` for the recipe). Don't claim init does this.
- `index rebuild --stage` skips the regen entirely (and stages nothing) when the recorded `nodes_hash` already matches the live tree, so the hook is a no-op when the indices are already fresh.
- For commits that bypassed the hook (e.g. `--no-verify`, or repos that haven't wired the hook): a CI check (`index rebuild` followed by `git diff --exit-code INDEX.md GRAPH.md`) catches the drift.
