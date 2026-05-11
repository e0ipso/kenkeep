---
title: CI recipe
parent: Getting Started
nav_order: 3
---

# CI recipe

CI's job is to validate that committed content is well-formed and that `INDEX.md` matches `nodes/`. Don't run `curate` or `bootstrap-incremental` in CI: they spawn `claude -p` and write proposals that need human review.

## What to check

1. `ai-knowledge-base doctor` (schemas, hooks, INDEX freshness, dangling refs).
2. `pre-commit run --all-files` (gitleaks).
3. `index rebuild` followed by `git diff --exit-code` on `INDEX.md` and `GRAPH.md`.

## GitHub Actions

```yaml
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
      - run: pip install pre-commit
      - run: pre-commit run --all-files
      - run: npm install --no-save @e0ipso/ai-knowledge-base
      - run: npx ai-knowledge-base doctor --verbose
      - run: |
          npx ai-knowledge-base index rebuild
          git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last step catches hand-edits to `nodes/` that bypassed the curator.

## GitLab CI

```yaml
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
```

## Running curate in CI

Possible but not recommended. It needs an authenticated `claude` CLI and writes proposals that still require human review. The repo intentionally ships no turnkey workflow for it.
