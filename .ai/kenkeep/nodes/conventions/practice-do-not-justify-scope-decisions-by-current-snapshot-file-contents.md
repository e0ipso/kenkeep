---
type: practice
title: Do not justify scope decisions by current-snapshot file contents
description: >-
  Claims like 'that folder only contains code' are snapshot observations, not
  guarantees; decide scope from the principle, not today's files.
tags:
  - yagni
  - assumptions
  - verification
kk_schema_version: 3
kk_id: practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents
kk_derived_from: []
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When deciding whether to include or exclude a path or folder from a behavior, do not justify the decision by what files currently live there (e.g. 'hooks dirs only contain .ts/.mjs today, so the markdown filter handles it'). That is a snapshot observation, not a guarantee -- user-authored or third-party additions can change the directory's contents at any time.

Decide scope from the underlying principle that motivated the rule. If the principle applies to the folder's purpose (e.g. 'AI instructions, not project docs'), apply the rule to the folder regardless of its current file inventory.

When tempted to narrow scope with 'that case does not exist today', re-check whether the motivating principle covers the omitted case. If yes, include it.
