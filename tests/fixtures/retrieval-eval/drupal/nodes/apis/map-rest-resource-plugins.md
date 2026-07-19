---
type: map
title: REST resources are ResourceBase plugins
description: >-
  Custom REST endpoints live as Plugin\rest\resource classes with RestResource
  attributes and resource config.
tags:
  - http
  - rest
  - plugins
kk_schema_version: 3
kk_id: map-rest-resource-plugins
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Attribute%21RestResource.php/class/RestResource/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Plugin%21ResourceBase.php/class/ResourceBase/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21ModifiedResourceResponse.php/class/ModifiedResourceResponse/11.x
kk_relates_to:
  - map-jsonrpc-method-plugins
  - practice-alter-and-debug-plugin-definitions-through-managers
  - practice-build-configurable-and-context-aware-plugins-with-cache-contexts
kk_depends_on: []
kk_confidence: medium
---
Custom REST resources live under the `Plugin\rest\resource` namespace and extend `ResourceBase`. Drupal 10/11 support the `#[RestResource]` attribute with an ID, label, and URI paths such as canonical and create endpoints; annotation examples are legacy-compatible.

REST resource behavior is enabled through configuration like `rest.resource.mymodule_items.yml`, where methods, formats, and authentication providers are declared. Read operations can return `ResourceResponse` with cacheable dependencies, while mutations can return `ModifiedResourceResponse` with an explicit status such as 201.

<!-- kk:related:start -->
# Related

- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
- Related: [practice-alter-and-debug-plugin-definitions-through-managers](/drupal/quality/practice-alter-and-debug-plugin-definitions-through-managers.md)
- Related: [practice-build-configurable-and-context-aware-plugins-with-cache-contexts](/drupal/data-cache/cache-render/practice-build-configurable-and-context-aware-plugins-with-cache-contexts.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Attribute%21RestResource.php/class/RestResource/11.x](https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Attribute%21RestResource.php/class/RestResource/11.x)
[2] [https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Plugin%21ResourceBase.php/class/ResourceBase/11.x](https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21Plugin%21ResourceBase.php/class/ResourceBase/11.x)
[3] [https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21ModifiedResourceResponse.php/class/ModifiedResourceResponse/11.x](https://api.drupal.org/api/drupal/core%21modules%21rest%21src%21ModifiedResourceResponse.php/class/ModifiedResourceResponse/11.x)
<!-- kk:citations:end -->
