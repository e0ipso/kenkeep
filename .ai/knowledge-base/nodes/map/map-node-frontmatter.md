---
schema_version: 1
id: map-node-frontmatter
title: "Node frontmatter shape"
kind: map
tags: [schema, frontmatter, node]
derived_from:
  - docs/internals/schemas.md
relates_to: []
confidence: high
summary: "Every node carries schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary."
---

# Node frontmatter shape

Every file under `nodes/` has YAML frontmatter validated by `NodeFrontmatterSchema` in `src/lib/schemas.ts`:

```yaml
schema_version: 2
id: practice-prefer-constructor-injection   # <kind>-<slug>
title: "..."
kind: practice | map
tags: [string, ...]
derived_from:
  - 20260510-1014-session-abc.md
relates_to: [string, ...]
depends_on: [string, ...]
confidence: low | medium | high
summary: "≤140 char summary, used in INDEX.md"
```

Key constraints:

- `id` is `<kind>-<slug>`; filename must be `<id>.md` under `nodes/<kind>/`.
- `derived_from` accepts a session log filename, a repo-relative doc path, or an absolute path. Dangling refs are warned about by `doctor --verbose`, not enforced.
- `relates_to` (loose) and `depends_on` (strict) cross-reference other node ids; both render in `GRAPH.md`.
- `summary` is capped at 140 characters and is what `INDEX.md` displays.
- Git history is the timeline of record; no timestamp fields are kept in frontmatter.
