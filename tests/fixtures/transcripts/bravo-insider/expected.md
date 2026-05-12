# Expected proposal output for transcript-bravo-insider.md

This is what the proposal extraction prompt should produce when run on the fixture transcript. Used to validate prompt correctness and as a target for integration tests.

## Expected JSON

```json
{
  "practice": [
    {
      "kind": "practice",
      "tags": ["drupal", "di", "controller"],
      "title": "Inject services via constructor; never \\Drupal::service() in controllers",
      "summary": "Controllers must use constructor injection and a create() factory, not \\Drupal::service() at point of use.",
      "body": "In this project, controllers receive their dependencies via constructor injection and a static `create()` method that pulls them from the container. Direct `\\Drupal::service()` calls inside controllers are not used.\n\nSee `modules/custom/bravo_cards/src/Controller/CardFeedController.php` as the canonical example.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    },
    {
      "kind": "practice",
      "tags": ["analytics", "events", "tracking"],
      "title": "Use bravo_analytics.dispatcher for all event tracking",
      "summary": "All analytics events (server- and client-side) go through bravo_analytics.dispatcher, not vanilla GA or Drupal's default analytics.",
      "body": "Both server-side and client-side analytics events fire through the `bravo_analytics.dispatcher` service (or its frontend shim at `Drupal.bravoAnalytics.track()`). Do not use Drupal's default analytics path and do not call `gtag()` or other backend-specific tracking directly from modules.\n\nThe rationale is single-point-of-control over the analytics backend. The dispatcher pattern was adopted after a painful per-module migration from Google Analytics to Segment last year — funneling through one service means future backend swaps don't require touching every module.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    },
    {
      "kind": "practice",
      "tags": ["caching", "personalization", "cache-tags", "drupal"],
      "title": "Personalized content uses per-user cache contexts and tags, not entity tags",
      "summary": "For pages whose content varies by authenticated user, set cache contexts to ['user'] and tags to ['user:<id>']; avoid node_list or entity tags.",
      "body": "Personalized rendering routes must not use Drupal's default entity-based cache tags (`node_list`, per-entity tags). Two failure modes otherwise: one user's content leaks into another user's cached response, or a single user's change forces site-wide cache invalidation.\n\nInstead, set on the render array:\n- `#cache.contexts = ['user']`\n- `#cache.tags = ['user:' . $current_user_id]`\n\nApplies to: any route serving content tailored to the current authenticated user.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    },
    {
      "kind": "practice",
      "tags": ["seo", "schema-org", "metadata"],
      "title": "Use bravo_seo.schema_emitter for schema.org metadata",
      "summary": "For schema.org structured data, use the bravo_seo.schema_emitter service; do not use Drupal's metatag module schema output.",
      "body": "Schema.org metadata is emitted via the `bravo_seo.schema_emitter` service, not Drupal's metatag module schema output. The project has custom property mappings that the metatag module doesn't produce correctly.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    }
  ],
  "map": [
    {
      "kind": "map",
      "tags": ["feature", "bravo-insider", "personalization"],
      "title": "Bravo Insider — personalized section for authenticated users",
      "summary": "Custom Drupal module at modules/custom/bravo_insider; surfaces user-tailored content at /insider.",
      "body": "Bravo Insider is a personalized section on the Bravo platform that surfaces content tailored to each authenticated user. Implemented as a custom Drupal module at `modules/custom/bravo_insider`. The main route is `/insider`, served by `InsiderController`, which pulls personalized content via the project's recommendation engine service.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    },
    {
      "kind": "map",
      "tags": ["service", "analytics", "dispatcher"],
      "title": "bravo_analytics.dispatcher — central analytics event router",
      "summary": "Drupal service that fans out tracking events to whatever analytics backend is currently wired in; has a frontend shim at Drupal.bravoAnalytics.track().",
      "body": "`bravo_analytics.dispatcher` is a custom Drupal service that handles all event tracking for the project. Its API is `->track($event_name, $payload)`. It exposes a frontend shim at `Drupal.bravoAnalytics.track()` for use from JS.\n\nThe dispatcher fans events out to whatever analytics backend is currently configured. Used to decouple modules from backend choice — historically GA, currently Segment. Lives in `modules/custom/bravo_analytics`.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    },
    {
      "kind": "map",
      "tags": ["service", "seo", "schema-org"],
      "title": "bravo_seo.schema_emitter — custom schema.org metadata service",
      "summary": "Service that emits schema.org structured data with project-specific property mappings.",
      "body": "`bravo_seo.schema_emitter` is the project's service for emitting schema.org structured data. It has custom property mappings that differ from what Drupal's metatag module would produce.",
      "confidence": "medium",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    }
  ]
}
```

## What was correctly NOT captured

The transcript contained several things that must not appear in the output:

1. **Typo fix** ("controler" → "controller"). Trivial, generic, not project knowledge.
2. **Getter method generation** (`getCurrentUserId()`). Routine code that worked first try; nothing to teach.
3. **File exploration** (`ls modules/custom/`, reading CardFeedController.php). Just orientation, not knowledge.
4. **Agent paraphrases.** Lines like "Got it. So you want me to inject..." restate what the user said. The user's original turn is the source, the paraphrase is not a separate teaching moment. If the prompt produced two practice nodes about DI (one from the user's "no, don't use \\Drupal::service()" and one from the agent's paraphrase), it would be wrong.
5. **The agent's mention of `gtag()`.** That came from the agent's first attempt, before the user corrected it. It's not the project's practice.

## Confidence calibration check

All four practice nodes are `confidence: high` because the user stated the rules explicitly. Two have explicit rationale (analytics dispatcher, cache tags), which would also warrant `high`. The schema.org node has weaker rationale ("we have custom property mappings"); that's still `high` because the rule itself is explicit.

The `bravo_seo.schema_emitter` map node is `confidence: medium` because the user mentioned it in passing without exploring it: we know what it does (custom schema.org) but not where it lives or its API surface.

## Curator follow-up checks against existing-kb.md

When this proposal output flows into the curator with the four existing nodes from the fixture KB, the curator should:

1. **Practice DI node:** proposal says "constructor injection." Existing `practice-controller-dependency-injection` covers it. Either **modify** (the new candidate adds the explicit "see CardFeedController" pointer and is consistent with the existing node, but doesn't add real new content) or **drop** (essentially the same). Lean drop.

2. **Practice analytics dispatcher node:** existing `practice-analytics-direct-ga` says "use vanilla GA." Direct contradiction. **contradict**. The new node says "use the dispatcher (we moved off GA)" and the existing node says "use GA directly." Cannot both be true. The kb-curate skill resolves the conflict in-session by asking the user to either replace (the old node file is deleted and a new node is written; the new node's id may match the deleted one) or reject (no change).

3. **Practice personalized cache tags node:** existing `practice-cache-tags-default` says "use default cache tags." The new candidate is an *exception* for personalized content, not a contradiction: the default rule still holds for non-personalized routes. **add** with `relates_to: [practice-cache-tags-default]`. The curator should NOT contradict the existing node.

4. **Practice schema.org node:** no existing node. **add**.

5. **Map Bravo Insider:** no existing node. **add**.

6. **Map dispatcher:** no existing node. **add**.

7. **Map schema_emitter:** no existing node. **add**.

The cache-tags case is the critical one: the curator prompt explicitly warns against treating exceptions as contradictions, and this is exactly the case that tests it.
