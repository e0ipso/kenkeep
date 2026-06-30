---
schema_version: 2
id: practice-use-origin-https-with-gh-minted-auth-for-pushes
title: Use origin-https with gh-minted auth for pushes
kind: practice
tags:
  - git
  - github
  - gh
  - authentication
  - remote
  - push
  - environment
derived_from: []
relates_to: []
depends_on: []
confidence: high
summary: >-
  In this environment, push GitHub changes through origin-https using a token
  minted by gh rather than SSH.
---
When pushing changes to GitHub from this environment, use the `origin-https` remote instead of the SSH `origin` remote. Authenticate the push with a token minted by `gh`, because GitHub CLI authentication is available here while SSH host trust and keys may not be.

Rationale: SSH pushes can fail in this environment due to missing `~/.ssh` setup or host-key verification. The HTTPS remote works with the existing `gh` login and avoids that environment-specific failure mode.
