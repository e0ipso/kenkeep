# rm_cards

Renders configurable card feeds for editorial content discovery.

## Location

`modules/custom/rm_cards/`

## Services

| Service ID | Class | Purpose |
|---|---|---|
| `rm_cards.source_resolver` | `CardSourceResolver` | Picks which entities go into a given feed based on feed config. |
| `rm_cards.field_mapper` | `CardFieldMapper` | Maps entity fields to card display fields. |

## Supported content types

Card feeds currently support: `article`, `event`, `content_type_x` (added Q1 2026).

When adding support for a new content type, update `CardFieldMapper::getMappingForBundle()` with the field mapping and add a kernel test under `tests/src/Kernel/`.

## Card feed configuration

Feeds are configured via the admin UI at `/admin/config/rivermark/card-feeds`. Configuration is stored as Drupal config entities of type `card_feed`.
