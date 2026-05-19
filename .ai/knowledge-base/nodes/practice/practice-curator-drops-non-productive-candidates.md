---
schema_version: 1
id: practice-curator-drops-non-productive-candidates
title: "Curator drops non-productive and change-oriented candidates"
kind: practice
tags: [curator, prompts, calibration, anti-pattern]
derived_from:
  - docs/internals/prompts.md
relates_to:
  - map-curator-action
  - map-proposal-candidate-schema
depends_on: []
confidence: high
summary: "Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak."
---

# Curator drops non-productive and change-oriented candidates

Two related calibrations from the curator prompt (v3):

1. **Change-oriented framing → drop.** Transition narratives, migration stories, rename or removal logs are an automatic drop regardless of confidence, **unless** a clean end-state claim can be salvaged.
2. **Non-productive provenance signatures → drop.** Candidates whose framing carries hedged wording, references to hypothetical entities, plan-scoped or task-scoped wording, or low-confidence-without-rationale. The curator weighs these signals **together** (not any single one in isolation); a combined signature is evidence the candidate originated from an abandoned, exploratory, cursory, unrelated, or meta-only session that slipped the extractor's session-disposition gate.

**Why:** the proposal-extract prompt has a session-disposition gate at the top that short-circuits non-productive sessions to `{ "practice": [], "map": [] }`. The curator's drop rule is the backstop — when something slips through, the curator catches it on the way to `nodes/` instead of pushing junk into the reviewer's diff.

**How to apply:**

- When tuning the curator prompt or its tests, preserve both rules. Both are load-bearing for KB quality (the "is this the right thing to remember" judgement at the §4 manual-test check.).
- Other documented anti-patterns to keep on the drop list: modifications that rephrase existing content (drop instead); additions when a near-duplicate exists (modify instead); emitting any non-null `suggested_resolution`; crossing the practice/map boundary.
