---
title: Internals
nav_order: 8
has_children: true
permalink: /internals/
---

# Internals

{% include callout.html variant="note" content="For contributors and adapter authors. Day-to-day users need only [How it works](../how-it-works.md) and [Daily use](../daily-use.md)." %}

- [Architecture](architecture.md): code layout, pipelines, state files, locking, the storage contract, where to extend.
- [Hooks](hooks.md): what each hook does, when it fires, and how the async ones stay out of the host's way.
- [Prompts and schemas](prompts.md): the prompts that decide what is kept, and the shapes of every file on disk.

Release checks and the prompt evaluator live in [CONTRIBUTING.md](https://github.com/e0ipso/kenkeep/blob/main/CONTRIBUTING.md).
