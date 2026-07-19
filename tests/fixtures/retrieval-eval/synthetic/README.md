# Synthetic retrieval control corpus

This frozen OKF-v3 corpus isolates deterministic prompt-retrieval behavior. Query terms are intentionally unusual so controls do not interfere with one another.

| Query / cluster | Engineered property |
| --- | --- |
| `quasar`: `practice-live-quasar-hub`, `practice-redirected-quasar-neighbor`, `practice-unlinked-quasar-peer` | The neighbor points at retired `practice-retired-quasar-hub`; `.redirects.json` resolves that id to the live hub, so the redirected neighbor gains a graph boost and outranks its otherwise equal unlinked peer. |
| `cobalt`: `practice-cobalt-anchor`, `practice-opaque-companion`, `practice-direct-cobalt-match` | The opaque companion has no lexical overlap and surfaces only through its edge to the anchor. The direct body match scores 1 and must remain above the boost-only companion at 0.5. |
| `symmetry`: four `practice-symmetry-*` candidates plus two `map-centrality-source-*` controls | Equal lexical scores expose tie-breaking: `central` has two incoming `kk_relates_to` edges and outranks `low`, which has one. `alpha` and `beta` have equal zero in-degree and therefore sort by `kk_id`. Source nodes avoid the query vocabulary. |
| `xylophone`: `practice-hidden-instrument` | The token occurs only in the markdown body, proving body-only matching. |
| `overflow`: six `practice-overflow-*` nodes | Long descriptions make five default-ranked entries collectively exceed the 1,800-character renderer budget, forcing whole-entry truncation mid-list. Their equal scoring also exercises deterministic id ordering. |
| `argonite` / `brenite`: two `practice-argonite-*` / `practice-brenite-*` pairs | Equality pins: a title-only hit (6) exactly ties a tag-plus-body hit (5 + 1), so order falls to the `kk_id` tie-break. The mirrored pair reverses which side owns the smaller id, so any nonzero drift of `TITLE_WEIGHT`, `TAG_WEIGHT`, or `BODY_WEIGHT` in either direction reorders one pair. |
| `corvane duskel` / `velune farrow`: two summary-equality pairs | Two summary hits (3 + 3) over a two-term prompt exactly tie one title hit (6), mirrored by id as above, pinning `SUMMARY_WEIGHT` against drift in either direction. |
| `flux`: two relay nodes plus two boost-only and two body-only members | Two graph-boost hits (0.5 + 0.5) exactly tie one body hit (1). The four members tie at 1.0 and interleave by `kk_id`; any drift of `GRAPH_NEIGHBOR_BOOST` or `BODY_WEIGHT` splits the tie group into blocks and reorders the interleaving. |

All graph references use ids. Leaves live in topical folders rather than legacy `map/` or `practice/` kind buckets, and every filename equals its `kk_id`.
