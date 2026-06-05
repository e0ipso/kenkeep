---
title: Callouts
parent: Internals
nav_order: 8
---

# Callouts

Semantic callouts for the docs site, ported from the dalia-ui `<Callout>`
component. Four variants, all in the warm brand palette (no traffic-light red).
Markup is emitted by [`_includes/callout.html`](https://github.com/e0ipso/kenkeep/blob/main/docs/_includes/callout.html); styling lives in `_sass/custom/custom.scss` and themes for both the light and dark schemes.

## Variants

{% include callout.html variant="tip" content="`tip`: dalia-tinted. Use for advice that improves an outcome but isn't required, e.g. *prefer the in-session skills*." %}

{% include callout.html variant="note" content="`note`: neutral cream surface with an ink left rule. Use for neutral asides and clarifications that don't change what the reader must do." %}

{% include callout.html variant="prereq" content="`prereq`: dalia tint with a dalia left rule. Use for things the reader must have in place *before* the steps that follow." %}

{% include callout.html variant="warning" content="`warning`: warm amber. Use for consequences worth pausing over: data loss, irreversible actions, security footguns." %}

## Authoring

Single line:

```liquid
{% raw %}{% include callout.html variant="tip" content="Prefer the in-session skills." %}{% endraw %}
```

Rich or multi-paragraph bodies: capture the markdown first so quotes, links, and
code survive intact:

```liquid
{% raw %}{% capture body %}
Multiple **paragraphs**, lists, and `code` all work here. Keep the captured
lines flush-left so kramdown doesn't read the indentation as a code block.
{% endcapture %}
{% include callout.html variant="warning" content=body %}{% endraw %}
```

### Parameters

| Param | Values | Default |
|---|---|---|
| `variant` | `tip` · `note` · `prereq` · `warning` | `note` |
| `content` | markdown string for the body (**required**) | none |
| `title` | overrides the default uppercase label | per-variant (`TIP`, `NOTE`, `BEFORE YOU BEGIN`, `CAUTION`) |
| `hide_title` | set truthy to drop the label | label shown |

A custom title (rendered uppercase by CSS):

{% include callout.html variant="tip" title="Model cost tip" content="A mid-tier model at moderate effort is plenty for curation." %}

## Caveat

Callouts are a **Jekyll-only** feature: they render as styled boxes on the docs
site but show as raw HTML on GitHub's markdown view. For content that must read
well in both places (e.g. the root `README.md`), use a plain bold-led blockquote
instead.
