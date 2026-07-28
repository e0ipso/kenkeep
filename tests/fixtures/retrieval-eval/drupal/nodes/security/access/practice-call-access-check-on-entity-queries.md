---
type: practice
title: Call accessCheck on entity queries
description: Every entity query must set accessCheck explicitly in Drupal 10 and later.
tags:
  - drupal
  - entities
  - queries
  - access
kk_schema_version: 3
kk_id: practice-call-access-check-on-entity-queries
kk_derived_from:
  - 'https://www.drupal.org/node/3201242'
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x
kk_relates_to:
  - practice-include-cache-metadata-in-entity-access-handlers
  - practice-prefer-entity-query-for-entity-retrieval
  - map-drupal-entity-form-bases
kk_depends_on: []
kk_confidence: high
---
Entity queries must set access checking explicitly. Use `accessCheck(TRUE)` for standard user-facing queries so node access grants and entity access rules are respected.

Use `accessCheck(FALSE)` only for intentional bypass scenarios such as administrative operations, cron, or migrations. Calling `accessCheck()` with no argument sets TRUE, but omitting access checking from a SQL entity query throws a query exception in Drupal 10 and later.

<!-- kk:related:start -->
# Related

- Related: [practice-include-cache-metadata-in-entity-access-handlers](/drupal/security/access/practice-include-cache-metadata-in-entity-access-handlers.md)
- Related: [practice-prefer-entity-query-for-entity-retrieval](/drupal/content-model/entities-fields/practice-prefer-entity-query-for-entity-retrieval.md)
- Related: [map-drupal-entity-form-bases](/drupal/presentation/forms/map-drupal-entity-form-bases.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/node/3201242](https://www.drupal.org/node/3201242)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x)
<!-- kk:citations:end -->
