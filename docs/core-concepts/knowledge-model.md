---
title: Knowledge model
parent: Core Concepts
nav_order: 2
---

# Knowledge model

Every curated piece of knowledge is a markdown file under `nodes/<kind>/<slug>.md` with Zod-validated YAML frontmatter. Two kinds.

## Practice: how we build

Imperative guidance. Conventions, prohibitions, gotchas.

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
derived_from:
  - 20260510-1014-session-abc.md
relates_to: [map-bravo-cards-module]
confidence: high
summary: "Inject dependencies via the constructor; avoid \\Drupal::service() in module code."
---

# Prefer constructor injection over service container lookups

The rule, the rationale, and when exceptions are OK.
```

## Map: what exists

Named entities. Modules, services, vocabulary, locations.

```yaml
---
schema_version: 1
id: map-bravo-cards-module
title: "Bravo Cards module"
kind: map
tags: [module, bravo, personalization]
summary: "Personalized card module at modules/custom/bravo_cards/."
---

# Bravo Cards module

What it is, where it lives, the major classes.
```

## Why two kinds

Practice answers "what should I do?" Map answers "what is this thing called?" The stage-2 prompt splits combined statements: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes one practice ("use the dispatcher") and one map ("what the dispatcher is").

## Validity

`valid_from` and `valid_until` are ISO-8601 timestamps. A node is current when `valid_until` is `null`. Accepting a `supersede` contradiction sets `valid_until` and `superseded_by` on the target. Superseded nodes stay in `nodes/` and surface under "Recently superseded" in `INDEX.md`.

Validity is informational. Nothing enforces it.

## Provenance

`derived_from` lists sources: a session log filename, a repo-relative doc path, or an absolute path. `doctor --verbose` lists references that no longer resolve; the consume path silently ignores them.

## Relations

`relates_to` (loose) and `depends_on` (strict) arrays of node ids. Not enforced. They feed `GRAPH.md` (full edge listing). `INDEX.md` does not render them.

## Confidence

`low` / `medium` / `high`. The curator defaults to `medium` when the source is implicit, `high` when stated explicitly with rationale. Edit by hand during proposal review.

## Schemas

All shapes live in [`src/lib/schemas.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/schemas.ts). That's the source of truth. v1 to v2 ships a migration script when it happens; until then a schema mismatch is treated as a parse failure.
