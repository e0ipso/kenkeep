---
type: practice
title: LLM-backed migrations require explicit --harness flag
description: >-
  Migrations that cluster nodes with an LLM must fail fast if the user did not
  pass --harness explicitly.
tags:
  - migration
  - cli
  - harness
  - llm
kk_schema_version: 3
kk_id: practice-llm-backed-migrations-require-explicit-harness-flag
kk_derived_from: []
kk_relates_to:
  - practice-explicit-harness-flag-outside-claude
  - practice-strict-schema-version-bump-policy
kk_depends_on: []
kk_confidence: high
---
Any migration step that requires an LLM must fail before spawning the harness if the `--harness` flag was not passed explicitly. The gate accepts only the explicit flag, not env detection or cliDefaultHarness. This prevents silent implicit harness selection during long-running LLM migrations.

<!-- kk:related:start -->
# Related

- Related: [practice-explicit-harness-flag-outside-claude](/harnesses/practice-explicit-harness-flag-outside-claude.md)
- Related: [practice-strict-schema-version-bump-policy](/node-schema/practice-strict-schema-version-bump-policy.md)
<!-- kk:related:end -->
