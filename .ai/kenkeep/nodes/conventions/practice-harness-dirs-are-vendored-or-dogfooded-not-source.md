---
type: practice
title: 'Harness directories are vendored or dogfooded, never source'
description: >-
  Repo-root harness dirs (.agents, .claude, .codex, .cursor, .opencode) hold
  vendored or dogfooded artifacts, not source.
tags:
  - harnesses
  - dogfooding
  - vendored
  - build
  - source-of-truth
  - code-review
kk_schema_version: 3
kk_id: practice-harness-dirs-are-vendored-or-dogfooded-not-source
kk_derived_from: []
kk_relates_to:
  - practice-ignore-harness-javascript-artifacts-in-prettier
  - map-hook-build-pipeline-ts-to-cjs
  - map-harness-adapter
kk_depends_on: []
kk_confidence: high
---
The repo-root harness directories are outputs, not inputs. `.claude/`, `.codex/`, `.cursor/`, `.opencode/`, and the `kk-*` trees under `.agents/` hold artifacts that `npx kenkeep init --upgrade` deploys out of `templates/`: the `.cjs` hooks are tsup bundles of `src/harnesses/<adapter>/hooks/*.ts`, and the `SKILL.md` files are composed from `src/templates-source/skills/*/SKILL.md.hbs`. Separately, `.agents/skills/st-*` is vendored third-party Strikethroo and has no source in this repo at all.

The two categories repair differently. For dogfooded artifacts, edit the TypeScript or Handlebars source, run `npm run build`, then `npx kenkeep init --upgrade` to redeploy. For vendored trees, take the upstream update. In neither case hand-edit the file in place: the next build or upgrade overwrites it.

Tooling that classifies authored code must exclude these paths. Prettier already does. The distinction matters for anything else that reasons about "source": linters, code review, search, and generated-file markers. Note that `templates/` is gitignored, so the only tracked copies of these generated artifacts are the ones in the harness directories, and that is where such tooling has to point.

<!-- kk:related:start -->
# Related

- Related: [practice-ignore-harness-javascript-artifacts-in-prettier](/conventions/practice-ignore-harness-javascript-artifacts-in-prettier.md)
- Related: [map-hook-build-pipeline-ts-to-cjs](/hooks/map-hook-build-pipeline-ts-to-cjs.md)
- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
<!-- kk:related:end -->
