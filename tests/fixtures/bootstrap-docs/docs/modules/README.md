# Module Index

Custom modules in `modules/custom/`. Each module has its own README in this directory.

| Module | Purpose | README |
|---|---|---|
| `rm_cards` | Card-feed rendering | [rm_cards.md](rm_cards.md) |
| `rm_analytics` | Analytics event dispatcher | [rm_analytics.md](rm_analytics.md) |
| `rm_seo` | SEO and schema.org emitter | [rm_seo.md](rm_seo.md) |
| `rm_discover` | Personalized user content | (not yet documented) |

## Module conventions

Every custom module follows the same layout:

```
modules/custom/<name>/
  <name>.info.yml
  <name>.module
  <name>.routing.yml
  <name>.services.yml
  src/
    Service/        # Plain-old PHP services, DI-friendly
    Controller/     # HTTP controllers
    Plugin/         # Drupal plugins (blocks, fields, etc.)
  tests/
    src/Unit/
    src/Kernel/
    src/Functional/
```

Tests are required for any new service class. Controllers are tested at the functional level only — they don't need unit tests if they delegate to well-tested services.
