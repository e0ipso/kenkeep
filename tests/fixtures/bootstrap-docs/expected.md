# Expected bootstrap output for bootstrap-docs/ fixture

This annotates what the agent-driven `/kb-bootstrap` and the deterministic `bootstrap-incremental` prompt should produce when run against the `bootstrap-docs/` fixture.

## Expected candidates by source doc

### `README.md`

**Practice:**
- "Use constructor-based DI in controllers; do not call `\\Drupal::service()` from controllers." `confidence: medium` (stated as a convention but no rationale in this doc — rationale appears in `dependency-injection.md` which the agent should follow and merge).
- "All analytics events flow through `bravo_analytics.dispatcher`; do not call `gtag()` or backend-specific tracking directly." `confidence: medium` (same — rationale is elsewhere).
- "Tests run with `vendor/bin/phpunit -c web/core`." `confidence: high` (explicit, complete in this doc).

**Map:**
- "BravoPlatform — Drupal-10-based content platform." `confidence: high`.
- "Repo layout: custom modules under `modules/custom/`, themes under `themes/custom/`, docs under `docs/`." `confidence: high`. (Optional — borderline whether this is worth a node. Lean yes for bootstrap, since map nodes during bootstrap are about establishing project vocabulary and structure.)

### `docs/architecture/README.md`

**Practice:**
- "When making a significant architectural change, write a new doc rather than updating old docs in place; link the old doc with 'superseded by'." `confidence: medium`.

(The note about referencing module READMEs is a soft convention, not capture-worthy on its own.)

### `docs/architecture/dependency-injection.md`

**Practice:**
- "Custom controllers, services, and form classes use constructor injection; `\\Drupal::service()` from inside these classes is not permitted. Hook implementations are an exception but should delegate to injected services." `confidence: high` — full rationale (testing, refactoring) included.

This should **merge with** the README-level mention into a single proposal, with `derived_from: [README.md, docs/architecture/dependency-injection.md]`. The agent-driven bootstrap should recognize the overlap and produce one richer node, not two.

### `docs/architecture/caching.md`

**Practice:**
- "For most rendering routes, use Drupal's default cache tags (`$entity->getCacheTags()`)." `confidence: high`.
- "For personalized content (varies by authenticated user), use `cache.contexts: ['user']` and `cache.tags: ['user:' . $current_user->id()]` — never entity-based tags. Two failure modes otherwise: cross-user leakage and site-wide invalidation." `confidence: high`.

The two are a related pair — one is the default rule, the other is the personalization exception. They should be written as two separate proposal nodes with `relates_to` linking them. A naive prompt might fold them into one node and lose clarity.

**Skip:**
- The PII handling reference (the doc says "not yet written; planned"). Aspirational, no actual content.
- The TODO about documenting the Redis migration. Aspirational.

### `docs/modules/README.md`

**Practice:**
- "Tests are required for any new service class. Controllers tested at the functional level only if they delegate to well-tested services." `confidence: high`.

**Map:**
- "Standard custom module layout: `*.info.yml`, `*.module`, `*.routing.yml`, `*.services.yml`, `src/{Service,Controller,Plugin}/`, `tests/src/{Unit,Kernel,Functional}/`." `confidence: high`.

### `docs/modules/bravo_cards.md`

**Map:**
- "bravo_cards — card-feed rendering module at `modules/custom/bravo_cards/`. Services: `CardSourceResolver` picks entities for a feed; `CardFieldMapper` maps entity fields to card fields. Supports article, event, content_type_x (added Q1 2026)." `confidence: high`.

**Practice:**
- "When adding support for a new content type to card feeds, update `CardFieldMapper::getMappingForBundle()` and add a kernel test." `confidence: high`.

### `docs/modules/bravo_analytics.md`

**Map:**
- "bravo_analytics.dispatcher — central analytics event service. Server API: `->track($event, $payload)`. Frontend shim: `Drupal.bravoAnalytics.track(name, payload)`. Backends are pluggable via `BackendInterface` and the `bravo_analytics_backend` service tag. Currently configured to Segment." `confidence: high`.

**Practice:**
- This module's README repeats the "use the dispatcher, not direct backend calls" rule with full rationale (three backend changes — GA → Segment → Heap → Segment). The agent-driven bootstrap should recognize the overlap with the README's mention and merge into a single proposal with richer rationale and full backend history. `derived_from: [README.md, docs/modules/bravo_analytics.md]`. `confidence: high`.

### `docs/modules/bravo_seo.md`

**Practice:**
- "Use `bravo_seo.schema_emitter` for schema.org structured data; do not use Drupal's metatag module schema output. Custom mappings live in `config/schemata/`." `confidence: high`.

**Map:**
- "bravo_seo.schema_emitter — service for emitting schema.org JSON-LD with project-specific property mappings. Mappings live in `config/schemata/`." `confidence: high`.

### `CONTRIBUTING.md`

**Practice:**
- "Code style: Drupal coding standards via `phpcs --standard=Drupal modules/custom`." `confidence: high`.
- "Unit and kernel tests required for any new service class. Functional tests run in CI only." `confidence: high` (overlaps with `docs/modules/README.md` — should merge).
- "Conventional commit format: `<type>(<scope>): <description>`. Types: feat, fix, refactor, docs, test, chore." `confidence: high`.
- "At least one approving review required before merging to main." `confidence: medium` (project-specific but boilerplate-adjacent — judgment call).

**Skip:**
- The setup commands. These are project orientation but the level of detail (`composer install`) is more "how to run the project" than "knowledge" — borderline; the agent might capture it as a single map-style node about "how to bring up a local environment" rather than four separate captures.

## Expected totals

If the agent-driven bootstrap merges overlapping captures correctly:

- **Practice candidates: ~9-10** (DI, analytics dispatcher rule, testing requirement, conventional commits, code style, default cache tags, personalized cache tags, schema_emitter, architectural-doc supersession convention, content-type-mapping update procedure).
- **Map candidates: ~6** (BravoPlatform overview, repo layout, module-layout convention, bravo_cards, bravo_analytics.dispatcher, bravo_seo.schema_emitter).

If the deterministic `bootstrap-incremental` runs on the same files (no merging across files):

- Same content but typically **2-3 more proposals total** due to per-file dedup limits — the DI rule, the analytics rule, and the testing rule each appear in 2-3 files and would produce duplicates that the curator (or a later dedup pass) would need to consolidate. This is expected and acceptable: the CLI is for incremental re-runs where docs are processed file-by-file. The agent path has better cross-file judgment.

## Failure modes this fixture catches

1. **Aspirational content captured.** A bad prompt might create a proposal node from the PII reference ("PII handling — encryption at rest planned") or the Redis migration TODO. Both must be skipped because the source is explicit that the content doesn't exist yet.

2. **Boilerplate captured.** `composer install`, MIT-style PR review process, standard `phpcs` runs. The bootstrap-incremental prompt should be tighter on these than the agent path; both should produce few.

3. **Default vs. exception conflated.** The default-cache vs. personalized-cache rules MUST be two separate nodes with `relates_to`. A prompt that produces one combined node loses the structure that lets the AI find the relevant rule for the route it's working on.

4. **Cross-file merging missed (agent path only).** The agent-driven bootstrap should recognize that the DI rule appears in 3 places (README, architecture doc, mentioned in module READMEs) and produce ONE rich proposal with `derived_from: [...]` listing all sources. A bad slash command might produce three separate proposals that the reviewer has to manually merge.

5. **API reference treated as knowledge.** The service tables in module docs (`CardSourceResolver` purpose, `CardFieldMapper` purpose) are partly map content (these things exist) and partly API reference (their purpose). The prompt should capture them as map nodes but not try to capture method signatures or parameter lists.

## What the test of the test looks like

If you run the agent-driven `/kb-bootstrap` against this fixture and get ~15 high-quality proposals with the merging described above, the prompt is calibrated correctly. If you get 25+ proposals with lots of obvious overlaps, the prompt is over-capturing or failing to merge. If you get 5 proposals, the prompt is under-capturing.
