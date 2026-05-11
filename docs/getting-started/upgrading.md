---
title: Upgrading
parent: Getting Started
nav_order: 4
---

# Upgrading

When a new release of `@e0ipso/ai-knowledge-base` ships changes to hook scripts, slash commands, or default prompts, you need to refresh the copies installed in your repo. `init --upgrade` does this safely: it preserves the things you have customized (your `.config.json`, your local prompt overrides) and refreshes everything else.

## TL;DR

```sh
npm install --save-dev @e0ipso/ai-knowledge-base@latest
npx @e0ipso/ai-knowledge-base init --assistants claude --upgrade
ai-knowledge-base doctor
```

## What gets refreshed

| Thing | Behavior |
|---|---|
| `.claude/hooks/*.mjs` | Always overwritten from the package. These are operational scripts; you should not customize them in place. |
| `.claude/commands/*.md` | Always overwritten from the package. |
| `.claude/settings.json` hook registrations | Refreshed (existing user-defined hook entries preserved; ai-knowledge-base entries replaced by the new versions). |
| `.gitignore` | Managed block is refreshed in place. New entries appear; existing user entries outside the block are untouched. |
| `.pre-commit-config.yaml` | Created only if missing. |
| `.ai/knowledge-base/.config.json` | Created only if missing. An existing file is never overwritten, regardless of `--force` or `--upgrade`. |
| `.ai/.kb-builder/prompts/*.md` | Copied only when missing locally. If a prompt already exists, it is preserved (the upgrade preflight reports it as a "local override preserved" line). |
| `.ai/.kb-builder/installed-version` | Stamped with the new package version. |

## Preflight first

`init --upgrade --dry-run` prints the changelist without writing:

```sh
ai-knowledge-base init --assistants claude --upgrade --dry-run
```

Sample output:

```
• Upgrade preflight in /path/to/repo
  installed: 1.0.0
  package:   1.5.0

Planned changes:
  • [hook-script]         refresh .claude/hooks/kb-capture.mjs
  • [hook-script]         refresh .claude/hooks/kb-stage2-drain.mjs
  • [slash-command]       refresh .claude/commands/kb-bootstrap.md
  • [prompt-preserved]    local override preserved: .ai/.kb-builder/prompts/curator.md
  • [hook-registration]   refresh ai-knowledge-base hook entries in .claude/settings.json
  • [installed-version]   stamp installed-version: 1.0.0 → 1.5.0

✓ --dry-run: 6 change(s) listed; nothing written.
```

When a prompt is preserved, the package's new bundled version is **not** copied — your override stays in effect. If you'd like to adopt the new bundled prompt, delete your override and re-run `init --upgrade`. The next preflight will report the file as `[prompt-new]` and copy the fresh template.

## Applying

Drop the `--dry-run` flag to apply:

```sh
ai-knowledge-base init --assistants claude --upgrade
```

The command is idempotent — running it twice in a row prints `Already at <version>. Nothing to do.` after the first successful run.

## When is an upgrade needed?

`ai-knowledge-base doctor` runs an `installed-version is current` check. When it warns, run `init --upgrade`:

```
⚠ installed-version is current: installed 1.0.0 ≠ package 1.5.0. Run `ai-knowledge-base init --upgrade` to refresh templates.
```

The check is a warning, not an error — the previous templates keep working until you upgrade — but you'll miss new slash commands or hook events shipped in subsequent releases.

## `--upgrade` vs. `--force`

| | `--force` | `--upgrade` |
|---|---|---|
| Overwrites hooks | yes | yes |
| Overwrites slash commands | yes | yes |
| Overwrites prompts | yes | **no** (preserved) |
| Overwrites `.config.json` | **no** (warns) | **no** |
| Refreshes `.claude/settings.json` hook entries | yes | yes |
| Stamps installed-version | yes | yes |
| Prints a preflight | no | yes |
| Pairs with `--dry-run` | no | yes |

Use `--upgrade` when bumping to a new package version. Use `--force` only when you've deliberately broken something and want to restore the original templates (it overwrites your local prompt customizations).
