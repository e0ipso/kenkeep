# Retrieval golden mutation verification

One-time verification run on 2026-07-17 with `npx vitest run tests/lib/prompt-retrieval-golden.test.ts`. Each arm changed only `src/lib/prompt-retrieval.ts`, ran the focused suite, and restored that file before the next arm. No production ranking change is retained.

The initial title, tag, and summary mutations passed silently. The synthetic corpus was therefore strengthened with three focused cases using a shared overflow competitor set and field-exclusive sentinels (`omega` in title, `tangerine` in tags, and `saffron` in description). Each affected arm was rerun and then failed by its named case.

| Lever | Temporary source edit | Observed named failing golden case |
| --- | --- | --- |
| `TITLE_WEIGHT` | `6` → `0` | `synthetic/retrieval/title-weight-overflow-omega` |
| `TAG_WEIGHT` | `5` → `0` | `synthetic/retrieval/tag-weight-overflow-tangerine` |
| `SUMMARY_WEIGHT` | `3` → `0` | `synthetic/retrieval/summary-weight-overflow-saffron` |
| `BODY_WEIGHT` | `1` → `0` | `synthetic/retrieval/body-only-xylophone` (also `synthetic/retrieval/cobalt-direct-match`) |
| `GRAPH_NEIGHBOR_BOOST` | `0.5` → `0` | `synthetic/multi-hop/cobalt-opaque-boost-only`, `drupal/multi-hop/jsonrpcmethod-testing-boost-only` |
| in-degree tie-break | disabled score-tie comparator branch | mechanics test `breaks equal-score ties by relates_to in-degree, then kk_id` (symmetry cluster) |
| stopword filtering | removed `'with'` from `STOPWORDS` | `drupal/refusal/unrelated-kubernetes` |

Final verification commands:

```sh
npx vitest run tests/lib/prompt-retrieval-golden.test.ts
git diff --exit-code -- src/lib/prompt-retrieval.ts
```

## Addendum: review hardening (2026-07-17)

Adversarial review found that the zeroing arms above overstated the corpus's
discriminating power: 9 of 10 single-step nudges (for example `TITLE_WEIGHT`
6 → 5 or `GRAPH_NEIGHBOR_BOOST` 0.5 → 0.75) passed the entire suite silently,
and disabling the score-tie in-degree comparator passed every test in the
repository. The corpus was strengthened and re-verified:

- A `weights/` cluster of exact equality pins (`TITLE = TAG + BODY`,
  `2 × SUMMARY = TITLE`, `2 × BOOST = BODY`) in mirrored `kk_id` order. Any
  nonzero perturbation of any single ranking constant, in either direction, now
  fails a named pin test. Verified for ±1 on each weight and ±0.25 on the boost,
  plus all five zeroings.
- The `ties` fixture sources previously leaked the query token `symmetry` into
  their bodies, so the central/low ordering was decided by graph boost rather
  than the in-degree tie-break; fixed, and disabling the in-degree comparator
  now fails `breaks equal-score ties by relates_to in-degree, then kk_id`.
- The three Drupal `multi-hop` cases passed unchanged with the boost disabled
  (purely lexical) and were relabeled `retrieval`. A genuine boost-only Drupal
  case was added: `drupal/multi-hop/jsonrpcmethod-testing-boost-only`
  (prompt `JsonRpcMethod`; `practice-test-jsonrpc-through-handler-and-http` is
  lexical-zero and surfaces only through its three matched JSON-RPC neighbors),
  which fails when `GRAPH_NEIGHBOR_BOOST` is zeroed.
