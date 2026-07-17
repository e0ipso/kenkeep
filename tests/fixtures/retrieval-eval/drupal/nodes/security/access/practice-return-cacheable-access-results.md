---
type: practice
title: Return cacheable AccessResult decisions
description: >-
  Drupal access checks must return AccessResult objects with the right cache
  metadata.
tags:
  - security
  - access
  - cache
  - drupal
kk_schema_version: 3
kk_id: practice-return-cacheable-access-results
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x
kk_relates_to:
  - practice-include-cache-metadata-in-entity-access-handlers
  - practice-route-access-requirements-and-cacheability
  - map-drupal-security-patterns-by-context
kk_depends_on: []
kk_confidence: high
---
Use Drupal's `AccessResult` API for programmatic access decisions: `allowed()`, `forbidden()`, `neutral()`, `allowedIf()`, and permission helpers.

Every `AccessResult` must include cache metadata that matches the decision inputs, such as `cachePerPermissions()`, `cachePerUser()`, URL contexts, or entity cacheable dependencies. Missing contexts can cache a stale access decision and become a security bug.

In entity handlers, implement `checkAccess()` and `checkCreateAccess()`, return `neutral()` when another checker should decide, and use `forbidden()` only when denial must be final. Entity queries should call `accessCheck(TRUE)`, and pass TRUE as the third argument to entity `access()` when cache metadata is needed.

<!-- kk:related:start -->
# Related

- Related: [practice-include-cache-metadata-in-entity-access-handlers](/drupal/security/access/practice-include-cache-metadata-in-entity-access-handlers.md)
- Related: [practice-route-access-requirements-and-cacheability](/drupal/security/access/practice-route-access-requirements-and-cacheability.md)
- Related: [map-drupal-security-patterns-by-context](/drupal/security/input-output/map-drupal-security-patterns-by-context.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Access%21AccessResult.php/class/AccessResult/11.x)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityAccessControlHandler.php/class/EntityAccessControlHandler/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x)
<!-- kk:citations:end -->
