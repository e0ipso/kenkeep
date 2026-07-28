---
type: practice
title: Include cache metadata in entity access handlers
description: >-
  Entity access results need cache metadata such as permission, user, or entity
  cache contexts/tags.
tags:
  - drupal
  - entities
  - access
  - cache
kk_schema_version: 3
kk_id: practice-include-cache-metadata-in-entity-access-handlers
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Cache%21CacheableDependencyInterface.php/interface/CacheableDependencyInterface/11.x
kk_relates_to:
  - practice-call-access-check-on-entity-queries
  - practice-return-cacheable-access-results
  - practice-route-access-requirements-and-cacheability
kk_depends_on: []
kk_confidence: medium
---
Entity access handlers should attach cache metadata to `AccessResult` responses. Use `cachePerPermissions()` for permission-wide decisions, `cachePerUser()` for owner-specific decisions, and add the entity as a cacheable dependency when the decision depends on entity state.

When adding a list builder, remember that parent::buildHeader() and parent::buildRow() add the operations column.

<!-- kk:related:start -->
# Related

- Related: [practice-call-access-check-on-entity-queries](/drupal/security/access/practice-call-access-check-on-entity-queries.md)
- Related: [practice-return-cacheable-access-results](/drupal/security/access/practice-return-cacheable-access-results.md)
- Related: [practice-route-access-requirements-and-cacheability](/drupal/security/access/practice-route-access-requirements-and-cacheability.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Cache%21CacheableDependencyInterface.php/interface/CacheableDependencyInterface/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Cache%21CacheableDependencyInterface.php/interface/CacheableDependencyInterface/11.x)
<!-- kk:citations:end -->
