---
type: practice
title: 'Use JSON:API for entity CRUD'
description: >-
  JSON:API exposes entity collection, item, relationship, upload, filter,
  include, sort, and pagination endpoints.
tags:
  - http
  - jsonapi
  - entities
  - crud
kk_schema_version: 3
kk_id: practice-use-jsonapi-for-entity-crud
kk_derived_from:
  - >-
    https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21jsonapi.api.php/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21src%21Routing%21Routes.php/class/Routes/11.x
  - 'https://www.drupal.org/project/jsonapi_extras'
kk_relates_to:
  - practice-guard-jsonrpc-entity-crud-access
  - map-drupal-entity-form-bases
  - map-jsonrpc-method-plugins
kk_depends_on: []
kk_confidence: high
---
Use Drupal core JSON:API for entity CRUD over `/jsonapi/{entity_type}/{bundle}` and `/jsonapi/{entity_type}/{bundle}/{uuid}`. The documented operations cover GET, POST, PATCH, and DELETE for article nodes, plus relationship endpoints for reading, adding, replacing, and removing related resources.

Keep JSON:API request details aligned with the documented gotchas: item paths use UUIDs rather than entity IDs, write requests should include `Content-Type: application/vnd.api+json`, file uploads use `application/octet-stream`, and filter access should be controlled with `hook_jsonapi_entity_filter_access()`, `hook_jsonapi_ENTITY_TYPE_filter_access()`, or `hook_jsonapi_entity_field_filter_access()`. JSON:API Extras is the contrib option for custom resource paths, disabled resources, field aliases, and enhancers.

<!-- kk:related:start -->
# Related

- Related: [practice-guard-jsonrpc-entity-crud-access](/drupal/apis/practice-guard-jsonrpc-entity-crud-access.md)
- Related: [map-drupal-entity-form-bases](/drupal/presentation/forms/map-drupal-entity-form-bases.md)
- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module](https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module)
[2] [https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21jsonapi.api.php/11.x](https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21jsonapi.api.php/11.x)
[3] [https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21src%21Routing%21Routes.php/class/Routes/11.x](https://api.drupal.org/api/drupal/core%21modules%21jsonapi%21src%21Routing%21Routes.php/class/Routes/11.x)
[4] [https://www.drupal.org/project/jsonapi_extras](https://www.drupal.org/project/jsonapi_extras)
<!-- kk:citations:end -->
