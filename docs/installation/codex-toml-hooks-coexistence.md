---
title: Codex hooks coexistence
parent: Installation
nav_order: 1
---

# `.codex/config.toml` already has a `[hooks]` table

`init --harnesses codex` writes its registration to `.codex/hooks.json`. If your repo already declares a `[hooks]` table in `.codex/config.toml`, the installer refuses to write. Codex treats both locations as authoritative, and a non-destructive TOML merge would lose your comments and ordering.

**Fix.** Append our four entries to your existing `[hooks]` table, then delete `.codex/hooks.json` so there is one source of truth.

```toml
[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "node ./.codex/hooks/kb-capture.mjs"
timeout = 30

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "node ./.codex/hooks/kb-lint-tick.mjs"
timeout = 30

[[hooks.SessionStart]]
[[hooks.SessionStart.hooks]]
type = "command"
command = "node ./.codex/hooks/kb-session-start.mjs"
timeout = 30

[[hooks.SessionStart]]
[[hooks.SessionStart.hooks]]
type = "command"
command = "node ./.codex/hooks/kb-proposal-drain.mjs"
timeout = 30
```

`init --upgrade` keeps refreshing the hook scripts under `.codex/hooks/`; only the registration location is yours to maintain. To uninstall later, drop any line whose `command` starts with `node ./.codex/hooks/kb-`.
