---
type: practice
title: Shipped skills and hook scripts must be self-contained
description: >-
  Skills, CLI launchers, and hook scripts may use only Node built-ins and
  relative-path references — no external file dependencies.
tags:
  - skills
  - hooks
  - cli
  - packaging
kk_schema_version: 3
kk_id: practice-shipped-skills-and-hook-scripts-must-be-self-contained
kk_derived_from: []
kk_relates_to:
  - map-hook-build-pipeline-ts-to-cjs
kk_depends_on: []
kk_confidence: medium
---
Shipped skills (`SKILL.md` workflows), CLI hook scripts, and harness hook bundles are self-contained: they rely on Node built-ins and paths relative to the script or skill directory, and do not depend on files outside the package or consumer install tree.

This keeps `init --upgrade` deployments portable and prevents hook failures when optional repo-local files are absent. Shared logic belongs in compiled bundles under `dist/` or inlined via the tsup `noExternal` hook build, not in ad-hoc imports from arbitrary paths.

<!-- kk:related:start -->
# Related

- Related: [map-hook-build-pipeline-ts-to-cjs](/hooks/map-hook-build-pipeline-ts-to-cjs.md)
<!-- kk:related:end -->
