---
type: practice
title: Distinguish Kenkeep development tooling from the Kenkeep product
description: >-
  Installed development tools and their lockfiles do not define Kenkeep's
  product behavior or distribution contract.
tags:
  - dogfooding
  - development
  - source-of-truth
  - distribution
kk_schema_version: 3
kk_id: practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product
kk_derived_from: []
kk_relates_to:
  - practice-harness-dirs-are-vendored-or-dogfooded-not-source
kk_depends_on: []
kk_confidence: high
---
Distinguish Kenkeep used to develop this repository from Kenkeep as the software being improved. Repository-local harness and agent directories, installed skills, and `skills-lock.json` describe the development environment. They do not establish the product's distribution contract or consumer installation behavior.

Assess product behavior through its sources, build and release configuration, published artifacts, and consumer installation flow. A path chosen by this repository's skill installer is evidence about that installation only. It gives Cursor or any other harness no privileged role in the product.

Keep this distinction when evaluating requested product improvements. Development-tool installation details do not establish product requirements or justify dismissing a request.

<!-- kk:related:start -->
# Related

- Related: [practice-harness-dirs-are-vendored-or-dogfooded-not-source](/conventions/practice-harness-dirs-are-vendored-or-dogfooded-not-source.md)
<!-- kk:related:end -->
