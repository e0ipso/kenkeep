# Retrieval golden mutation verification

One-time verification run on 2026-07-17 with `npx vitest run tests/lib/prompt-retrieval-golden.test.ts`. Each arm changed only `src/lib/prompt-retrieval.ts`, ran the focused suite, and restored that file before the next arm. No production ranking change is retained.

The initial title, tag, and summary mutations passed silently. The synthetic corpus was therefore strengthened with three focused cases using a shared overflow competitor set and field-exclusive sentinels (`omega` in title, `tangerine` in tags, and `saffron` in description). Each affected arm was rerun and then failed by its named case.

| Lever | Temporary source edit | Observed named failing golden case |
| --- | --- | --- |
| `TITLE_WEIGHT` | `6` → `0` | `synthetic/retrieval/title-weight-overflow-omega` |
| `TAG_WEIGHT` | `5` → `0` | `synthetic/retrieval/tag-weight-overflow-tangerine` |
| `SUMMARY_WEIGHT` | `3` → `0` | `synthetic/retrieval/summary-weight-overflow-saffron` |
| `BODY_WEIGHT` | `1` → `0` | `synthetic/retrieval/body-only-xylophone` (also `synthetic/retrieval/cobalt-direct-match`) |
| `GRAPH_NEIGHBOR_BOOST` | `0.5` → `0` | `synthetic/multi-hop/cobalt-opaque-boost-only` |
| stopword filtering | removed `'with'` from `STOPWORDS` | `drupal/refusal/unrelated-kubernetes` |

Final verification commands:

```sh
npx vitest run tests/lib/prompt-retrieval-golden.test.ts
git diff --exit-code -- src/lib/prompt-retrieval.ts
```
