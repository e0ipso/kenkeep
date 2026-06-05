---
title: Internals
nav_order: 7
has_children: true
permalink: /internals/
---

# Internals

{% capture audience %}
For contributors and adapter authors. **Day-to-day users do not need anything here**, see [How it works](../how-it-works.md) and [Daily use](../daily-use.md).
{% endcapture %}
{% include callout.html variant="note" content=audience %}

- [Architecture](architecture.md) - code layout, state files, locking, determinism contract.
- [Hooks](hooks.md) - what each hook does and when it fires.
- [Schemas](schemas.md) - frontmatter and state-file shapes.
- [Prompts](prompts.md) - editing the proposal, curator, and bootstrap prompts.
- [Knowledge base navigation](kk-navigation.md) - why the SessionStart payload carries a 3-layer navigation directive, and why it lives there and nowhere else.
- [Manual test plan](manual-test-plan.md) - pre-release checks that resist automation.
