---
type: practice
title: Consumers are responsible for secret hygiene
description: >-
  kenkeep does not scan or redact secrets in the capture pipeline; secret
  hygiene is the consumer's responsibility.
tags:
  - security
  - secrets
  - capture
  - documentation
kk_schema_version: 3
kk_id: practice-consumers-are-responsible-for-secret-hygiene
kk_derived_from: []
kk_relates_to:
  - map-capture-hook
kk_depends_on: []
kk_confidence: high
---
kenkeep does not perform secret scanning or redaction in the capture pipeline. Consumers are responsible for their own secret hygiene. The `init` command does not install secretlint, and the `doctor` command does not verify secret-scan availability.

<!-- kk:related:start -->
# Related

- Related: [map-capture-hook](/hooks/map-capture-hook.md)
<!-- kk:related:end -->
