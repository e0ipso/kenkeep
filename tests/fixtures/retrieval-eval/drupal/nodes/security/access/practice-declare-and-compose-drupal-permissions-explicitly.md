---
type: practice
title: Declare and compose Drupal permissions explicitly
description: >-
  Define static or dynamic permissions and use route requirement syntax
  carefully for OR and AND checks.
tags:
  - drupal
  - permissions
  - access
kk_schema_version: 3
kk_id: practice-declare-and-compose-drupal-permissions-explicitly
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes'
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21user%21src%21PermissionHandler.php/class/PermissionHandler/11.x
  - 'https://api.drupal.org/api/drupal/core%21core.api.php/group/user_api/11.x'
kk_relates_to:
  - practice-call-access-check-on-entity-queries
  - practice-include-cache-metadata-in-entity-access-handlers
  - practice-prefer-specific-form-and-neutral-access-hooks
kk_depends_on: []
kk_confidence: medium
---
Declare static permissions in `mymodule.permissions.yml`, and use `permission_callbacks` when permissions must be generated dynamically. Mark dangerous administrative permissions with `restrict access: true` so the UI shows the appropriate warning.

On routes, `_permission` uses `+` for OR semantics and `,` for AND semantics inside one requirement. Separate route requirements are combined by the route access system. For programmatic checks, call `hasPermission()` on the current user account.

<!-- kk:related:start -->
# Related

- Related: [practice-call-access-check-on-entity-queries](/drupal/security/access/practice-call-access-check-on-entity-queries.md)
- Related: [practice-include-cache-metadata-in-entity-access-handlers](/drupal/security/access/practice-include-cache-metadata-in-entity-access-handlers.md)
- Related: [practice-prefer-specific-form-and-neutral-access-hooks](/drupal/security/access/practice-prefer-specific-form-and-neutral-access-hooks.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes](https://www.drupal.org/docs/drupal-apis/routing-system/structure-of-routes)
[2] [https://api.drupal.org/api/drupal/core%21modules%21user%21src%21PermissionHandler.php/class/PermissionHandler/11.x](https://api.drupal.org/api/drupal/core%21modules%21user%21src%21PermissionHandler.php/class/PermissionHandler/11.x)
[3] [https://api.drupal.org/api/drupal/core%21core.api.php/group/user_api/11.x](https://api.drupal.org/api/drupal/core%21core.api.php/group/user_api/11.x)
<!-- kk:citations:end -->
