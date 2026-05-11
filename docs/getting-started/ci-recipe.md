---
title: CI recipe
parent: Getting Started
nav_order: 3
---

# CI recipe

`@e0ipso/ai-knowledge-base` is designed to run primarily in the contributor's local environment. The hooks fire during real Claude Code sessions; the curator runs when a human deliberately invokes it. CI's job is narrower: **guarantee that what's been committed is well-formed and not stale.**

This page is an opinionated minimum. Extend it as your project's needs grow.

## What CI should check

1. **`doctor`.** Validates schemas, hook registration, INDEX freshness, dangling `derived_from`. Exits non-zero on errors (warnings are OK).
2. **Pre-commit hooks pass.** `pre-commit run --all-files` runs gitleaks (and anything else you've added). This catches an accidental secret commit that slipped past the local pre-commit install.
3. **No drift between `nodes/` and `INDEX.md`.** Running `ai-knowledge-base index rebuild` and then checking `git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md` ensures the index in source control matches the nodes. Trivial to wire in.

You should **not** run `ai-knowledge-base curate` or `ai-knowledge-base bootstrap-incremental` in CI by default. Both invoke `claude -p`, both write proposals that need human review. CI is not the reviewer.

## GitHub Actions example

```yaml
# .github/workflows/kb.yml
name: knowledge-base

on:
  pull_request:
    paths:
      - '.ai/knowledge-base/**'
      - '.claude/**'
      - '.pre-commit-config.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Install pre-commit
        run: pip install pre-commit

      - name: Run gitleaks (and any other pre-commit hooks)
        run: pre-commit run --all-files

      - name: Install ai-knowledge-base
        run: npm install --no-save @e0ipso/ai-knowledge-base

      - name: doctor
        run: npx ai-knowledge-base doctor --verbose

      - name: INDEX is in sync with nodes/
        run: |
          npx ai-knowledge-base index rebuild
          git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last step is the most important. If a contributor merged a hand-edit to `nodes/` without re-running the curator (or `index rebuild`), CI catches it.

## GitLab CI example

```yaml
# .gitlab-ci.yml
kb_validate:
  image: node:22
  before_script:
    - apt-get update && apt-get install -y python3-pip
    - pip3 install pre-commit
    - npm install --no-save @e0ipso/ai-knowledge-base
  script:
    - pre-commit run --all-files
    - npx ai-knowledge-base doctor --verbose
    - npx ai-knowledge-base index rebuild
    - git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
  rules:
    - changes:
        - .ai/knowledge-base/**/*
        - .claude/**/*
        - .pre-commit-config.yaml
```

## What about running `claude -p` in CI?

You can — for example, to gate merging behind a curate pass on changed session logs — but it requires:

1. An authenticated `claude` CLI in the CI environment (a long-lived API key bound to a CI-only Anthropic account).
2. Acceptance that proposals will be written automatically and need to be reviewed before merging.
3. Patience: the curator's per-batch timeout is 120 s by default, so a backlog of 30 sessions can take several minutes.

The repo intentionally does not ship a turnkey "auto-curate" CI workflow. Two reasons:

- The reviewer is the merge mechanism. Auto-writing proposals to a PR is fine; auto-merging proposals into `nodes/` defeats the design.
- Authentication varies wildly across orgs. We don't want to canonicalize one approach.

If you want to wire this up, the building blocks are:

```yaml
- name: Run curate
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx ai-knowledge-base curate

- name: Open PR for proposals
  if: ${{ hashFiles('.ai/knowledge-base/_proposed/additions/*') != ''
        || hashFiles('.ai/knowledge-base/_proposed/modifications/*') != ''
        || hashFiles('.ai/knowledge-base/_proposed/contradictions/*') != '' }}
  run: |
    # Open a PR with the new proposals for human review.
    # Use your team's preferred PR-opening action here.
```

## What about INDEX as a deploy artifact?

If you publish your KB to a docs site, `INDEX.md` and `GRAPH.md` are valid jumping-off points. The deterministic-regen invariant means a docs build can call `ai-knowledge-base index rebuild` first to refresh them; or you can rely on `INDEX.md`'s `generated_at` frontmatter to decide whether to bust caches.

## Catching schema-version mismatches early

When you bump to schema v2 (whenever that ships), CI is the right place to fail loudly. The runtime fails closed on shapes it can't validate — the file becomes a parse failure, surfaces in `doctor`, and CI's `doctor --verbose` step catches it. No special wiring needed.
