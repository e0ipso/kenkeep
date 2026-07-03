---
type: practice
title: Use origin-https with gh-minted auth for pushes
description: >-
  In this environment, push GitHub changes through origin-https using a token
  minted by gh rather than SSH.
tags:
  - git
  - github
  - gh
  - authentication
  - remote
  - push
  - environment
kk_schema_version: 3
kk_id: practice-use-origin-https-with-gh-minted-auth-for-pushes
kk_derived_from: []
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When pushing changes to GitHub from this environment, use the `origin-https` remote instead of the SSH `origin` remote. Authenticate the push with a token minted by `gh`, because GitHub CLI authentication is available here while SSH host trust and keys may not be.

Rationale: SSH pushes can fail in this environment due to missing `~/.ssh` setup or host-key verification. The HTTPS remote works with the existing `gh` login and avoids that environment-specific failure mode.
