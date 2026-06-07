---
schema_version: 2
id: practice-cursor-sessionstart-additional-context-is-silently-dropped
title: Cursor sessionStart additional_context is silently dropped
kind: practice
tags:
  - cursor
  - harness
  - hooks
  - gotcha
  - context-injection
derived_from: []
relates_to:
  - map-cursor-harness-adapter
confidence: high
summary: >-
  Cursor's sessionStart hook writes additional_context but it never reaches the
  model due to a confirmed race condition (May 2026).
---
As of May 2026, Cursor's `sessionStart` hook accepts the `additional_context` field in its JSON output and logs it as "merged successfully," but the content is silently dropped before the agent window is created due to a race condition. Multiple forum reports confirm this behavior.

The Cursor adapter in this project currently relies on `additional_context` to inject the knowledge base index and queue status into the model's context. As a result, the model in Cursor does not actually receive the knowledge base index via the hook — it only receives it if the user has the static pointer in AGENTS.md and opens the ENTRY.md file explicitly.

The only reliable mechanism for injecting persistent context into Cursor's model at session start is static rules files under `.cursor/rules/`.
