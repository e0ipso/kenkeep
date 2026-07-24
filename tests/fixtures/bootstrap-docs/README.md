# Rivermark CMS

A custom Drupal-based content platform.

## Overview

Rivermark CMS is built on Drupal 10 with custom modules organized under `modules/custom/`. The platform serves personalized content to authenticated users and provides a card-feed UI for editorial content discovery.

## Repo layout

```
modules/
  contrib/        # Drupal contrib modules, managed by Composer
  custom/         # Our custom modules
    rm_cards/           # Card-feed rendering
    rm_analytics/       # Custom analytics dispatcher
    rm_seo/             # SEO and schema.org emitter
    rm_discover/        # Personalized user content
themes/
  custom/
    rm_theme/           # Main site theme
docs/
  architecture/         # High-level design docs
  modules/              # Per-module documentation
```

## Development conventions

This project follows Drupal coding standards, with a few project-specific additions:

- All custom controllers use constructor-based dependency injection. Do not call `\Drupal::service()` from inside controllers — inject services explicitly. See `docs/architecture/dependency-injection.md`.
- All analytics events flow through `rm_analytics.dispatcher`. Do not fire `gtag()` or other backend-specific tracking calls directly from modules. See `docs/modules/rm_analytics.md`.
- Tests run with `vendor/bin/phpunit -c web/core` from the repo root.

## Getting started

```
composer install
vendor/bin/drush si --existing-config
vendor/bin/drush cr
```

## Documentation

- [Architecture overview](docs/architecture/README.md)
- [Module index](docs/modules/README.md)
- [Coding standards](CONTRIBUTING.md)
