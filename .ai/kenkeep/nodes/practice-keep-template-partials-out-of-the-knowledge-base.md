---
type: practice
title: Keep template partials out of the knowledge base
description: >-
  Use build-time partials only for shipped prompt/skill sources, never generated
  or curated KB markdown.
tags:
  - templates
  - prompts
  - knowledge-base
  - build
kk_schema_version: 3
kk_id: practice-keep-template-partials-out-of-the-knowledge-base
kk_derived_from: []
kk_relates_to:
  - practice-bump-prompt-version-comment
  - practice-shipped-skills-and-hook-scripts-must-be-self-contained
kk_depends_on: []
kk_confidence: high
---
Template partials are for source assets that build into shipped prompt or skill files, such as `src/templates-source/skills/**` and, when versioned carefully, `src/templates-source/prompts/**`.

Do not introduce partial rendering into generated or curated knowledge-base markdown: `.ai/kenkeep/ENTRY.md`, `.ai/kenkeep/GRAPH.md`, `.ai/kenkeep/nodes/**`, or their `templates/kenkeep/**` scaffold equivalents. Knowledge-base files remain plain, self-contained markdown reviewed in git; generated index files stay deterministic outputs of the index generator.

Mechanical prompt/skill partials are low risk when rendered output is unchanged. Policy prompt partials can change model behavior and require version bumps plus rendered-output tests that preserve each workflow's local authority rules.

<!-- kk:related:start -->
# Related

- Related: [practice-bump-prompt-version-comment](/config-and-prompts/practice-bump-prompt-version-comment.md)
- Related: [practice-shipped-skills-and-hook-scripts-must-be-self-contained](/hooks/practice-shipped-skills-and-hook-scripts-must-be-self-contained.md)
<!-- kk:related:end -->
