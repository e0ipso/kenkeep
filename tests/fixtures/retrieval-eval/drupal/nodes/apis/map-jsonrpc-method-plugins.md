---
type: map
title: JSON-RPC methods are attribute plugins
description: >-
  The JSON-RPC API uses contrib method plugins declared with JsonRpcMethod and
  served through /jsonrpc.
tags:
  - http
  - jsonrpc
  - plugins
kk_schema_version: 3
kk_id: map-jsonrpc-method-plugins
kk_derived_from:
  - 'https://www.drupal.org/project/jsonrpc'
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php
kk_relates_to:
  - practice-guard-jsonrpc-entity-crud-access
  - practice-test-jsonrpc-through-handler-and-http
  - practice-use-jsonrpc-for-business-logic
kk_depends_on: []
kk_confidence: medium
---
JSON-RPC support requires the `drupal/jsonrpc` contrib module. Current 3.x methods are plugins using the `#[JsonRpcMethod]` attribute, an ID such as `mymodule.get_item`, usage text, optional parameter definitions, and an `execute(\Drupal\jsonrpc\JsonRpcObject\ParameterBag $params): mixed` method when parameters are accepted. Older 2.x examples may use annotations.

Clients normally call methods with JSON-RPC 2.0 payloads via `/jsonrpc` using `Content-Type: application/json`. The main current implementation points are `src/MethodInterface.php`, `src/Attribute/JsonRpcMethod.php`, `src/JsonRpcObject/ParameterBag.php`, and `src/Controller/HttpController.php`.

<!-- kk:related:start -->
# Related

- Related: [practice-guard-jsonrpc-entity-crud-access](/drupal/apis/practice-guard-jsonrpc-entity-crud-access.md)
- Related: [practice-test-jsonrpc-through-handler-and-http](/drupal/quality/practice-test-jsonrpc-through-handler-and-http.md)
- Related: [practice-use-jsonrpc-for-business-logic](/drupal/apis/practice-use-jsonrpc-for-business-logic.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/project/jsonrpc](https://www.drupal.org/project/jsonrpc)
[2] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Attribute/JsonRpcMethod.php)
[3] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php)
<!-- kk:citations:end -->
