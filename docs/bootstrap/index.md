---
title: Bootstrap
nav_order: 4
has_children: true
permalink: /bootstrap/
---

# Bootstrap

Seed the KB from existing markdown docs. Two pipelines:

- **[First-time (`/kb-bootstrap`)](first-time-bootstrap.md)** is agent-driven and supervised. Best for messy doc trees that need judgment.
- **[Incremental (`bootstrap-incremental`)](incremental-bootstrap.md)** is a deterministic, hash-aware CLI. Use for re-runs after docs change.

Both write to `_proposed/additions/` and update `bootstrap-state.json`. The reviewer accepts or rejects.
