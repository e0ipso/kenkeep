---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000005
harness: claude
captured_at: '2026-01-15T10:20:00.000Z'
---
[USER]: The Harbor API resources appear in the wrong order on the partner discovery page after the config import.
[AGENT]: I’ll reproduce it through the discovery page test and inspect the configuration subscriber before changing the sort.
[AGENT]: The subscriber calls `ksort()` on the resource map. The unit fixture uses integer keys, so I suspect the comparison is lexical only after import.
[USER]: I expected numeric order. Patch the sort and run the discovery test.
[AGENT]: I changed the key comparison to numeric and the direct-array discovery test passes.
[AGENT]: The exported fixture still comes back in the wrong order. My first hypothesis was incomplete, so I’m dumping the post-import structure rather than adjusting the comparator again.
[USER]: Here is the gotcha: Drupal configuration normalizes those map keys as strings before our subscriber sees them. Harbor resource ordering must sort the `weight` value inside each entry, never the YAML key. Key sorting will fail again after export and import.
[AGENT]: Confirmed in the imported config: the map keys no longer preserve the author’s numeric intent, while each entry still has its `weight`.
[AGENT]: I’m replacing key sorting with a stable value sort on `weight`, with the YAML key only as the deterministic tie-breaker.
[USER]: Add a round-trip fixture. A test that builds the array directly will hide the config normalization problem.
[AGENT]: The new fixture exports and imports the config before building discovery output. It failed against the old key sort and passes against the value sort.
[AGENT]: The full Harbor discovery suite passes. The test now protects the config normalization boundary rather than an in-memory array shape.
