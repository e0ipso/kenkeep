---
schema_version: 1
id: map-practice-node
title: "Practice node: how-we-build, imperative guidance"
kind: map
tags: [vocabulary, node-kind, practice]
derived_from:
  - docs/how-it-works.md
  - docs/internals/schemas.md
  - PRD.md
relates_to: [map-map-node, map-nodes-directory]
depends_on: []
confidence: high
summary: "A practice node captures imperative project guidance: conventions, prohibitions, gotchas, decision rationale, tooling. Stored under nodes/practice/."
---

# Practice node: how-we-build, imperative guidance

A **practice** node captures "how we build things": conventions ("when adding X, use Y"), prohibitions ("don't use the default cache tags for entity X"), gotchas (finicky third-party details, race conditions), decision rationale ("we use approach X because Y didn't handle the multilingual case"), and tooling/workflow notes ("tests run with `vendor/bin/phpunit ...`").

Stored at `.ai/knowledge-base/nodes/practice/<id>.md`. The id slug is `practice-<slug>`. Frontmatter shape is defined by `NodeFrontmatterSchema` in `src/lib/schemas.ts`.

The proposal extractor splits combined statements: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes one practice (use the dispatcher) plus one map (what the dispatcher is). Imperative content belongs to practice; nominative content belongs to map. The boundary is enforced by the prompt; do not cross it in hand-authored or curator-proposed nodes.
