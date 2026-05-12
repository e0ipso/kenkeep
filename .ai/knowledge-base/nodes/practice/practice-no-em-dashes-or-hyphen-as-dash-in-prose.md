---
schema_version: 1
id: practice-no-em-dashes-or-hyphen-as-dash-in-prose
title: "No em-dashes or hyphen-as-dash in prose"
kind: practice
tags: [prose, style, docs, commits]
valid_from: "2026-05-12T11:20:00Z"
valid_until: null
updated: "2026-05-12T11:20:00Z"
supersedes: null
superseded_by: null
derived_from: []
relates_to: []
depends_on: []
confidence: high
summary: "Never use `—`, `–`, or ` - ` as a separator in project prose. Use commas, colons, or parentheses instead."
---

# No em-dashes or hyphen-as-dash in prose

Do not use `—` (em-dash), `–` (en-dash), or ` - ` (hyphen surrounded by spaces) as a sentence-level separator anywhere in the project. Rewrite using a comma, colon, parentheses, or a sentence break.

**Why:** The maintainer dislikes dash-separators and finds them visually noisy. Em-dashes are also a strong tell for LLM-generated text, which makes human-authored prose feel machine-laundered. Keeping prose dash-free preserves voice and signals authorship.

**How to apply:** Scope is every English string we author in this repo: KB node bodies, markdown docs, source code comments, commit messages, PR titles and descriptions, and chat replies. Hyphens inside compound words (`hyphen-as-dash`, `pre-commit`, `well-formed`) are fine, since those are not separators. Ranges in tables or numerics may still use `–` if a true en-dash range is needed, but prefer `to` in prose (`Monday to Friday`, not `Monday–Friday`).
