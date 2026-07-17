---
type: practice
title: Define route access with explicit requirements and cache metadata
description: >-
  Use YAML requirements or tagged custom checkers, and always cache AccessResult
  decisions correctly.
tags:
  - drupal
  - routing
  - access
  - cache
kk_schema_version: 3
kk_id: practice-route-access-requirements-and-cacheability
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes'
  - >-
    https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes/custom-route-access-checking
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Routing%21Access%21AccessInterface.php/interface/AccessInterface/11.x
kk_relates_to:
  - practice-custom-breadcrumb-builders
  - practice-include-cache-metadata-in-entity-access-handlers
  - practice-return-cacheable-access-results
kk_depends_on: []
kk_confidence: high
---
Routes can declare access through YAML requirements such as `_permission`, `_role`, `_entity_access`, or `_custom_access`. Multiple permissions inside `_permission` use `+` for OR semantics and `,` for AND semantics.

Custom access checkers receive upcasted route parameters and should return `AccessResult` objects with the cache contexts and tags that make the decision safe. Missing cache metadata can produce stale access decisions.

When registering an access checker service with a custom requirement key, keep the explicit `access_check` tag and `applies_to` value; these tags are not autoconfigured.

<!-- kk:related:start -->
# Related

- Related: [practice-custom-breadcrumb-builders](/drupal/data-cache/cache-render/practice-custom-breadcrumb-builders.md)
- Related: [practice-include-cache-metadata-in-entity-access-handlers](/drupal/security/access/practice-include-cache-metadata-in-entity-access-handlers.md)
- Related: [practice-return-cacheable-access-results](/drupal/security/access/practice-return-cacheable-access-results.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes](https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes)
[2] [https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes/custom-route-access-checking](https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes/custom-route-access-checking)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Routing%21Access%21AccessInterface.php/interface/AccessInterface/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Routing%21Access%21AccessInterface.php/interface/AccessInterface/11.x)
<!-- kk:citations:end -->
