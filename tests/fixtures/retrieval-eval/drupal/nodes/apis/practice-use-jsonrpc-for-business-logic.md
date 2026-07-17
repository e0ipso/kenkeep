---
type: practice
title: Use JSON-RPC for business logic
description: >-
  JSON-RPC is the documented fit for actions, workflows, batch operations, and
  other non-REST business behavior.
tags:
  - http
  - jsonrpc
  - api
  - workflow
kk_schema_version: 3
kk_id: practice-use-jsonrpc-for-business-logic
kk_derived_from:
  - 'https://www.drupal.org/project/jsonrpc'
  - 'https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/jsonrpc.routing.yml'
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/modules/jsonrpc_discovery/jsonrpc_discovery.routing.yml
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php
kk_relates_to:
  - map-jsonrpc-method-plugins
  - practice-guard-jsonrpc-entity-crud-access
  - practice-test-jsonrpc-through-handler-and-http
kk_depends_on: []
kk_confidence: high
---
Use JSON:API for entity CRUD and JSON-RPC for business logic that does not fit REST, such as cache clearing, workflows, and batch operations. JSON-RPC provides the `/jsonrpc` endpoint, JSON Schema parameter validation, and batch requests; method discovery at `/jsonrpc/methods` is provided by the `jsonrpc_discovery` submodule.

Define methods with `JsonRpcMethodBase`, `#[JsonRpcMethod]`, `JsonRpcParameterDefinition`, and `JsonRpcObject\ParameterBag`. Represent expected client failures with JSON-RPC errors such as `Error::invalidParams()`, and use method-level `access` metadata for required permissions when access can be expressed declaratively.

<!-- kk:related:start -->
# Related

- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
- Related: [practice-guard-jsonrpc-entity-crud-access](/drupal/apis/practice-guard-jsonrpc-entity-crud-access.md)
- Related: [practice-test-jsonrpc-through-handler-and-http](/drupal/quality/practice-test-jsonrpc-through-handler-and-http.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/project/jsonrpc](https://www.drupal.org/project/jsonrpc)
[2] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/jsonrpc.routing.yml](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/jsonrpc.routing.yml)
[3] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/modules/jsonrpc_discovery/jsonrpc_discovery.routing.yml](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/modules/jsonrpc_discovery/jsonrpc_discovery.routing.yml)
[4] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php)
<!-- kk:citations:end -->
