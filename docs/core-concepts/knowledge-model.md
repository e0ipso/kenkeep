---
title: Knowledge model
parent: Core Concepts
nav_order: 2
---

# Knowledge model

Every piece of curated knowledge lives in a single markdown file under `.ai/knowledge-base/nodes/<kind>/<slug>.md` with a small Zod-validated YAML frontmatter. Two kinds:

## Practice nodes — _how we build_

Imperative project guidance. Conventions, prohibitions, gotchas, workflow rules.

```yaml
---
schema_version: 1
id: practice-prefer-constructor-injection
title: "Prefer constructor injection over service container lookups"
kind: practice
tags: [drupal, di, services]
valid_from: 2026-05-10T14:30:00Z
valid_until: null
updated: 2026-05-10T14:30:00Z
supersedes: null
superseded_by: null
derived_from:
  - 20260510-1014-session-abc.md
relates_to: [map-bravo-cards-module]
depends_on: []
confidence: high
summary: "Inject dependencies via the constructor; avoid \Drupal::service() in module code."
---

# Prefer constructor injection over service container lookups

Body explains the rule, the rationale, and when an exception is OK.
```

## Map nodes — _what exists_

Named entities in this project. Modules, services, vocabulary, locations.

```yaml
---
schema_version: 1
id: map-bravo-cards-module
title: "Bravo Cards module"
kind: map
tags: [module, bravo, personalization]
…
summary: "Personalized card module at modules/custom/bravo_cards/."
---

# Bravo Cards module

What it is, where it lives, the major classes.
```

## Why two kinds

A practice ("always do X") and a map entry ("X is our module for Y") feel similar but are useful at different moments. Practice nodes answer "what should I do?" Map nodes answer "what is this thing called?" The stage-2 prompt and the curator are calibrated to split combined content across both kinds — when a doc says "use `bravo_analytics.dispatcher` — our service for tracking events," the practice node owns "use the dispatcher" and the map node owns "what the dispatcher is."

## Validity window

`valid_from` and `valid_until` are ISO-8601 timestamps. A node is "valid" when `valid_until` is `null`. Superseded nodes get `valid_until` set to the supersession time and `superseded_by` set to the new node's id. The reviewer manages this automatically when accepting a contradiction proposal with `suggested_resolution: supersede`.

Validity is informational, not enforced. Superseded nodes still live in `nodes/`; they're listed under "Recently superseded" at the bottom of `INDEX.md` for the most recent 5.

## Provenance

`derived_from` lists the source of the node. Three flavors:

- A session log filename (`20260510-1014-session-abc.md`) — the node came from a captured conversation.
- A repo-relative path (`docs/architecture/auth.md`) — the node came from existing documentation via `/kb-bootstrap` or `bootstrap-incremental`.
- An absolute path — rare, but supported for nodes seeded from outside the repo.

`ai-knowledge-base doctor --verbose` lists `derived_from` references that no longer resolve on disk. Stale references are a warning, not an error — the consume path silently ignores them; the curator treats them as "evidence not available" and proceeds.

## Relations

`relates_to` (loose) and `depends_on` (strict ordering) are arrays of node ids. They are not enforced — there is no foreign-key check. They feed `GRAPH.md` (the unfiltered edge listing) which the assistant can read when it wants to walk the graph. `INDEX.md` does not render them.

## Confidence

`low` / `medium` / `high`. The curator and bootstrap-incremental default to `medium` when the source is implicit or the doc looks aspirational; they escalate to `high` when the rule is stated explicitly with rationale and the source looks actively maintained. The reviewer can edit confidence during `proposals review` by hand-editing the proposal frontmatter before accepting it.

## Schema versioning

Every frontmatter shape (nodes, session logs, proposals, INDEX/GRAPH frontmatter, state files) carries `schema_version: 1`. v1 to v2 will ship a migration script under `src/lib/migrations/`. Hand-edit the schema at your own risk — `proposals review` and `doctor` both fail closed on shapes they can't validate.

## Where the schemas live

All Zod schemas are in [`src/lib/schemas.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/schemas.ts). Re-read it when you're unsure what a field allows; the source of truth is the schema, not the docs.
