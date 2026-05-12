# Fixture: existing KB nodes (4)

Used to test curator decisions. The transcript should produce, among other things, candidates that overlap with these.

---

## nodes/practice/practice-controller-dependency-injection.md

```yaml
---
schema_version: 1
id: practice-controller-dependency-injection
title: "Inject services via constructor; never use \\Drupal::service() in controllers"
kind: practice
tags: [drupal, di, controller]
derived_from:
  - 2026-02-14-1000-controller-di.md
relates_to: []
depends_on: []
confidence: high
summary: "Drupal controllers must inject services via constructor + create(); no service-locator pattern."
---

# Constructor injection for controllers

All controllers in this project receive their dependencies via constructor injection and a static `create()` factory. Direct `\Drupal::service()` calls inside controllers are prohibited.

See `modules/custom/bravo_cards/src/Controller/CardFeedController.php` as the canonical example.
```

---

## nodes/map/map-bravo-cards.md

```yaml
---
schema_version: 1
id: map-bravo-cards
title: "Bravo Cards — card-feed rendering module"
kind: map
tags: [module, bravo-cards, ui]
derived_from:
  - 2026-01-08-1500-cards-intro.md
  - 2026-03-22-1145-cards-content-type-x.md
relates_to: []
depends_on: []
confidence: high
summary: "Custom Drupal module that renders card feeds; supports article, event, and content-type-x entities."
---

# Bravo Cards

Custom Drupal module at `modules/custom/bravo_cards`. Renders card feeds with configurable data sources.

Helper services control which data to pull into the feed (CardSourceResolver) and which fields are mapped onto each card (CardFieldMapper).

Currently supports: article, event, content-type-x (added 2026-03-22).
```

---

## nodes/practice/practice-analytics-direct-ga.md

```yaml
---
schema_version: 1
id: practice-analytics-direct-ga
title: "Use vanilla Google Analytics events for client-side tracking"
kind: practice
tags: [analytics, ga, frontend]
derived_from:
  - 2025-08-01-0900-analytics-rollout.md
relates_to: []
depends_on: []
confidence: medium
summary: "Fire Google Analytics events directly from JS for click and pageview tracking."
---

# Direct GA event firing

For frontend analytics, fire `gtag()` events directly from JS. Pageviews are auto-tracked by the GA snippet; custom events are sent via `gtag('event', name, payload)`.

Per-module ownership: each module fires its own events.
```

This is a **stale node** — the transcript reveals the project moved off vanilla GA last year. The curator should flag this as a contradiction candidate.

---

## nodes/practice/practice-cache-tags-default.md

```yaml
---
schema_version: 1
id: practice-cache-tags-default
title: "Use Drupal default cache tags for entity-rendering pages"
kind: practice
tags: [caching, drupal, cache-tags]
derived_from:
  - 2025-11-05-1330-caching-intro.md
relates_to: []
depends_on: []
confidence: high
summary: "For entity-rendering routes, use Drupal's automatic cache tags (node_list, entity tags)."
---

# Default cache tags

Most rendering routes can rely on Drupal's automatic cache tag invalidation. The `node_list` tag and per-entity tags handle the vast majority of cases without manual intervention.

Set `'#cache' => ['tags' => $entity->getCacheTags()]` on render arrays.
```

This node is **true for most pages but the transcript reveals an exception** — personalized content needs different cache contexts/tags. The curator should NOT contradict the existing node (it's still right for non-personalized routes); it should add a new node about the personalized-content exception and link them via `relates_to`.
