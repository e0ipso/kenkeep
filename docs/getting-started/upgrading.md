---
title: Upgrading
parent: Getting Started
nav_order: 4
---

# Upgrading

`init --upgrade` refreshes hooks, skills, and bundled prompts while preserving your `.config.json` and any local prompt overrides.

## Usage

```sh
npm install --save-dev @e0ipso/ai-knowledge-base@latest
npx @e0ipso/ai-knowledge-base init --assistants claude --upgrade
ai-knowledge-base doctor
```

Add `--dry-run` to print the planned changelist without writing.

## What gets refreshed

| File | Behavior |
|---|---|
| `.claude/hooks/*.mjs` | Always overwritten. |
| `.claude/skills/*` | Always overwritten. |
| `.claude/settings.json` | Hook entries refreshed; user entries preserved. |
| `.gitignore` | Managed block refreshed in place. |
| `.pre-commit-config.yaml` | Created only if missing. |
| `.ai/knowledge-base/.config.json` | Never overwritten. |
| `.ai/knowledge-base/.state/prompts/*` | Only copied if absent (local overrides preserved). |
| `installed-version` | Stamped with the new version. |

If you want a new bundled prompt, delete your override and re-run `init --upgrade`.

## When to upgrade

`doctor` warns when `installed-version` lags the package:

```
installed-version is current: installed 1.0.0 ≠ package 1.5.0. Run `ai-knowledge-base init --upgrade`.
```

The old templates keep working; you just miss new commands or hooks until you upgrade.

## `--upgrade` vs `--force`

|  | `--force` | `--upgrade` |
|---|---|---|
| Overwrites hooks/skills | yes | yes |
| Overwrites prompts | yes | **no** |
| Overwrites `.config.json` | no | no |
| Preflight + `--dry-run` | no | yes |

Use `--upgrade` for version bumps. Use `--force` only to restore originals after intentional breakage.

## Legacy state directory

Older installs stored state under `.ai/.kb-builder/`. Newer versions use `.ai/knowledge-base/.state/`. Every `init`, `doctor`, and CLI command migrates content from the legacy path automatically on first run. Commit the moved files.
