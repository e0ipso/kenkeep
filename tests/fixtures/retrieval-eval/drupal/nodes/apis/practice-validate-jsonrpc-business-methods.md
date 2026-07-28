---
type: practice
title: Validate JSON-RPC business methods
description: >-
  Advanced JSON-RPC methods should validate transitions, limits, file inputs,
  and storage errors explicitly.
tags:
  - http
  - jsonrpc
  - validation
  - errors
kk_schema_version: 3
kk_id: practice-validate-jsonrpc-business-methods
kk_derived_from:
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Exception/JsonRpcException.php
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php
  - >-
    https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php
kk_relates_to:
  - map-jsonrpc-method-plugins
  - practice-guard-jsonrpc-entity-crud-access
  - practice-test-jsonrpc-through-handler-and-http
kk_depends_on: []
kk_confidence: medium
---
For complex JSON-RPC methods, put business validation inside the method before mutating state. The documented patterns validate state-machine transitions, enforce batch limits such as a maximum item count, check access per item, validate uploaded file extensions and decoded size, and dispatch domain events after successful state changes.

Use `JsonRpcException::fromError()` with standard `Error` objects for client-visible failures. Wrap storage exceptions or unexpected internal failures so server details are logged but callers receive an internal JSON-RPC error rather than raw exception details.

<!-- kk:related:start -->
# Related

- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
- Related: [practice-guard-jsonrpc-entity-crud-access](/drupal/apis/practice-guard-jsonrpc-entity-crud-access.md)
- Related: [practice-test-jsonrpc-through-handler-and-http](/drupal/quality/practice-test-jsonrpc-through-handler-and-http.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Exception/JsonRpcException.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/Exception/JsonRpcException.php)
[2] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/Error.php)
[3] [https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php](https://git.drupalcode.org/project/jsonrpc/-/blob/3.0.1/src/JsonRpcObject/ParameterBag.php)
<!-- kk:citations:end -->
