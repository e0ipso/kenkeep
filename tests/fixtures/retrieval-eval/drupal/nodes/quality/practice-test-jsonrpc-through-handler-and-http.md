---
type: practice
title: Test JSON-RPC through handler and HTTP paths
description: >-
  JSON-RPC testing covers kernel handler calls, functional HTTP calls, mocks,
  batch requests, and error responses.
tags:
  - http
  - jsonrpc
  - testing
kk_schema_version: 3
kk_id: practice-test-jsonrpc-through-handler-and-http
kk_derived_from:
  - 'https://www.drupal.org/project/jsonrpc'
  - 'https://www.jsonrpc.org/specification'
kk_relates_to:
  - map-jsonrpc-method-plugins
  - practice-guard-jsonrpc-entity-crud-access
  - practice-use-jsonrpc-for-business-logic
kk_depends_on: []
kk_confidence: medium
---
For sites using the contributed JSON-RPC module, test methods at the kernel level by enabling `jsonrpc` and the owning module, installing required entity schemas and config, setting the current user, and invoking the `jsonrpc.handler` service with JSON-RPC request bodies. Assert both successful `result` payloads and expected `error` payloads for unauthorized or invalid requests.

Add functional HTTP coverage for `/jsonrpc` when request transport matters, including authenticated POSTs with `Content-Type: application/json`. Cover mocked dependencies for direct method execution, batch requests preserving IDs, invalid-parameter errors with code `-32602`, and method-not-found errors with code `-32601`.

<!-- kk:related:start -->
# Related

- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
- Related: [practice-guard-jsonrpc-entity-crud-access](/drupal/apis/practice-guard-jsonrpc-entity-crud-access.md)
- Related: [practice-use-jsonrpc-for-business-logic](/drupal/apis/practice-use-jsonrpc-for-business-logic.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/project/jsonrpc](https://www.drupal.org/project/jsonrpc)
[2] [https://www.jsonrpc.org/specification](https://www.jsonrpc.org/specification)
<!-- kk:citations:end -->
