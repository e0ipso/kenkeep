# kenkeep Index: overview

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
_None yet._

## Components (what exists)
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) to learn about: Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, hooks/, conflicts/. #layout #state #directory
- Open [**kenkeep docs site custom domain**](map-kenkeep-docs-site-custom-domain.md) to learn about: The Jekyll docs site is configured for https://kenkeep.canpicasoft.com with an empty baseurl. #docs #github-pages #jekyll
- Open [**kenkeep npm package**](map-kenkeep-package.md) to learn about: Per-repo knowledge base from AI sessions: installs hooks, captures redacted slices, a curator writes nodes/, ENTRY injected each session. #overview #package #npm
- Open [**docs/assets/diagrams/ (docs site SVG diagrams)**](map-docs-assets-diagrams-docs-site-svg-diagrams.md) to learn about: Hand-authored SVG diagrams for the docs site, in the cream-and-ink house palette with pink marking reader-performed steps. #docs #diagrams #assets #svg

## By topic

### #docs
- Open [**kenkeep docs site custom domain**](map-kenkeep-docs-site-custom-domain.md) — The Jekyll docs site is configured for https://kenkeep.canpicasoft.com with an empty baseurl.
- Open [**Docs are short and structured; the README keeps its reader hooks**](../conventions/practice-docs-are-short-and-structured-the-readme-keeps-its-reader-hooks.md) — Documentation is organized and terse for human readers, and the README's hero, slides, why-cards and packs teaser stay in place.
- Open [**docs/assets/diagrams/ (docs site SVG diagrams)**](map-docs-assets-diagrams-docs-site-svg-diagrams.md) — Hand-authored SVG diagrams for the docs site, in the cream-and-ink house palette with pink marking reader-performed steps.
### #assets
- Open [**docs/assets/diagrams/ (docs site SVG diagrams)**](map-docs-assets-diagrams-docs-site-svg-diagrams.md) — Hand-authored SVG diagrams for the docs site, in the cream-and-ink house palette with pink marking reader-performed steps.
- Open [**Per-repo notification icon asset**](../hooks/map-per-repo-notification-icon-asset.md) — Linux SessionStart notifications use .ai/kenkeep/assets/notification-icon.png copied into each initialized repo.
### #diagrams
- Open [**docs/assets/diagrams/ (docs site SVG diagrams)**](map-docs-assets-diagrams-docs-site-svg-diagrams.md) — Hand-authored SVG diagrams for the docs site, in the cream-and-ink house palette with pink marking reader-performed steps.
### #directory
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) — Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, hooks/, conflicts/.
### #github-pages
- Open [**kenkeep docs site custom domain**](map-kenkeep-docs-site-custom-domain.md) — The Jekyll docs site is configured for https://kenkeep.canpicasoft.com with an empty baseurl.
### #jekyll
- Open [**kenkeep docs site custom domain**](map-kenkeep-docs-site-custom-domain.md) — The Jekyll docs site is configured for https://kenkeep.canpicasoft.com with an empty baseurl.
### #layout
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) — Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, hooks/, conflicts/.
### #npm
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base from AI sessions: installs hooks, captures redacted slices, a curator writes nodes/, ENTRY injected each session.
### #overview
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base from AI sessions: installs hooks, captures redacted slices, a curator writes nodes/, ENTRY injected each session.
### #package
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base from AI sessions: installs hooks, captures redacted slices, a curator writes nodes/, ENTRY injected each session.
### #state
- Open [**Session log (_sessions/*.md)**](../state/map-session-log.md) — Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id; frontmatter tracks capture, proposal, and curator phases.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](../bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
### #svg
- Open [**docs/assets/diagrams/ (docs site SVG diagrams)**](map-docs-assets-diagrams-docs-site-svg-diagrams.md) — Hand-authored SVG diagrams for the docs site, in the cream-and-ink house palette with pink marking reader-performed steps.