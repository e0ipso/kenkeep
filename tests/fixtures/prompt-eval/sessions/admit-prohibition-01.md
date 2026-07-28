---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000003
harness: claude
captured_at: '2026-01-15T10:10:00.000Z'
---
[USER]: The Orchard Search index is stale after an article is republished. Fix the invalidation subscriber.
[AGENT]: I’ll reproduce the stale result and trace the save subscriber into the index refresh path.
[AGENT]: The subscriber currently invalidates only the article cache tag. I was going to add `node_list` so the listing and search projection rebuild together.
[USER]: No. Never invalidate `node_list` from Orchard Search. That tag fans out across unrelated listings. Queue an `orchard_index` reindex message for the changed content UUID instead.
[AGENT]: Understood. I’ll remove the broad invalidation idea and enqueue one `orchard_index` message keyed by content UUID.
[AGENT]: The new kernel assertion failed because save and publish each enqueued the same UUID. I’m checking the subscriber guards rather than weakening the expected count.
[USER]: The prohibition applies to every Orchard Search subscriber, not just this one. The queue is our isolation boundary for index refreshes.
[AGENT]: `rg` found another `node_list` invalidation in the taxonomy subscriber. I’ll convert both call sites and deduplicate the article publish path.
[AGENT]: The queue worker already coalesces UUIDs, but the producer contract is still one message per save. The subscriber guard now enforces that.
[USER]: Good. Add a test that each save enqueues one `orchard_index` message and does not invalidate the broad tag.
[AGENT]: The kernel test records exactly one queue message for the changed content UUID and no `node_list` invalidation.
[AGENT]: Both Orchard subscribers pass their focused suites, and the broad cache tag no longer appears in the module diff.
