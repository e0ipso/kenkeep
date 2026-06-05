---
schema_version: 1
id: practice-testing-philosophy-few-tests-mostly-integration
title: 'Testing philosophy: few tests, mostly integration'
kind: practice
tags:
  - testing
  - philosophy
  - integration-tests
  - coverage
derived_from: []
relates_to: []
confidence: high
summary: >-
  This repo deliberately keeps a small test suite weighted toward integration
  tests; redundant unit tests are pruned.
---
The project follows "Write tests. Not too many. Mostly integration." as its governing test-design principle. Integration tests that exercise real flows (CLI commands, harness adapters, hook pipelines end to end) are the default and preferred tier.

Unit tests are reserved for genuinely tricky pure logic (hashing, schema validation, naming rules) where an integration test would be a poor probe. When coverage overlaps, prefer one good integration test over many narrow unit tests, and delete redundant tests rather than letting the suite grow.

An "excessive test bed" (many low-value or duplicative unit tests) is treated as debt to be consolidated, not an asset.
