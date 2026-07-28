---
type: practice
title: Guard JSON-RPC entity CRUD access
description: >-
  JSON-RPC CRUD methods should combine permission attributes, runtime entity
  checks, accessCheck, and current-user checks.
tags:
  - http
  - jsonrpc
  - crud
  - access
kk_schema_version: 3
kk_id: practice-guard-jsonrpc-entity-crud-access
kk_derived_from:
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x
kk_relates_to:
  - map-jsonrpc-method-plugins
  - practice-test-jsonrpc-through-handler-and-http
  - practice-use-jsonapi-for-entity-crud
kk_depends_on: []
kk_confidence: medium
---
When implementing entity CRUD through JSON-RPC, combine method-level permission requirements with runtime access checks. Current JSON-RPC method definitions use `access` metadata for coarse permissions, `$entity->access('update')` or `$entity->access('delete')` before mutations, `accessCheck(TRUE)` on entity queries, and current-user comparisons for own-profile style methods.

CRUD methods are expected to validate entity existence and bundle before update or delete, return stable identifiers such as `nid` and `uuid` after creation, and paginate lists with explicit `page` and `limit` parameters.

<!-- kk:related:start -->
# Related

- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
- Related: [practice-test-jsonrpc-through-handler-and-http](/drupal/quality/practice-test-jsonrpc-through-handler-and-http.md)
- Related: [practice-use-jsonapi-for-entity-crud](/drupal/apis/practice-use-jsonapi-for-entity-crud.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Aaccess/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21Query%21QueryInterface.php/function/QueryInterface%3A%3AaccessCheck/11.x)
<!-- kk:citations:end -->
