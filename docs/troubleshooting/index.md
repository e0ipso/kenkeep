---
title: Troubleshooting
nav_order: 7
has_children: true
permalink: /troubleshooting/
---

# Troubleshooting

Pages:

- [Common issues](common-issues.md) — the symptoms most contributors hit, in order of frequency.
- [Reading stage-2 logs](reading-stage-2-logs.md) — interpreting the stream-json traces under `_logs/stage-2/`.
- [Reading curator logs](reading-curator-logs.md) — interpreting the stream-json traces under `_logs/curator/`.
- [Pruning logs](pruning-logs.md) — bounding the growth of `_logs/` with `ai-knowledge-base logs prune`.

Most checks have a CLI form: `ai-knowledge-base doctor --verbose` is the first command to run when something is off. See [PRD §9](https://github.com/e0ipso/ai-knowledge-base/blob/main/PRD.md#9-failure-modes-the-user-sees) for the canonical failure-mode catalog.
