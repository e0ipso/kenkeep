---
type: map
title: Per-repo notification icon asset
description: >-
  Linux SessionStart notifications use .ai/kenkeep/assets/notification-icon.png
  copied into each initialized repo.
tags:
  - hooks
  - notifications
  - assets
kk_schema_version: 3
kk_id: map-per-repo-notification-icon-asset
kk_derived_from:
  - '96b49c42-b254-4bca-a9c2-40579b0ed896:map:0'
kk_relates_to:
  - map-session-start-hook
  - map-kenkeep-directory
kk_depends_on: []
kk_confidence: medium
---
# Per-repo notification icon asset

Linux SessionStart notifications use the kenkeep mark from `.ai/kenkeep/assets/notification-icon.png` when that file is present in the initialized repository. The session-start hooks run as standalone scripts installed under `.ai/kenkeep/hooks/`, so runtime notification code resolves the icon from the repo-local `.ai/kenkeep/assets/` tree rather than from the npm package templates directory.

The icon is a committed static asset in `src/templates-source/kenkeep/assets/notification-icon.png`; `build:templates` copies it into the shipped templates tree, and `init`/upgrade copy it into each repo's `.ai/kenkeep/assets/` directory.

<!-- kk:related:start -->
# Related

- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
- Related: [map-kenkeep-directory](/overview/map-kenkeep-directory.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [96b49c42-b254-4bca-a9c2-40579b0ed896:map:0](96b49c42-b254-4bca-a9c2-40579b0ed896:map:0)
<!-- kk:citations:end -->
