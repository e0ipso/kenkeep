---
name: kenkeep-init
description: Fully initialize a repo for Kenkeep with Claude Code and Grok Build. Use when the user says init kenkeep, bootstrap kenkeep, set up kenkeep, make this repo kenkeep, drive this repo with kenkeep, new kenkeep repo, or /kenkeep-init.
---

# kenkeep-init

Run the shipped scripts. Do not reimplement init, hook wiring, or CLAUDE.md by hand.

## Script

From the skill directory (resolve via this SKILL.md's path):

```sh
scripts/init-repo.sh
```

Or with an explicit repo root:

```sh
scripts/init-repo.sh /absolute/path/to/repo
```

Default harnesses are `claude,grok`. Override only if the user names others:

```sh
KENKEEP_HARNESSES=claude,grok scripts/init-repo.sh
```

`resolve-kenkeep.sh` is sourced by `init-repo.sh`. Do not call it alone unless debugging.

## After the script

1. Report the script's stdout/stderr and `doctor` result.
2. Tell the user to run `/hooks-trust` once in Grok in that repo (or `grok --trust`). Do not write `~/.grok/trusted_folders.toml`.
3. If doctor failed because kenkeep is not grok-capable, tell them to run `~/Projects/KenKeep/scripts/install-cli.sh`. Do not fall back to `npx kenkeep`.

## Do not

- Enable Grok experimental memory
- `kno init` unless that repo's work port is already `knots`
- Copy kk-* skills into `.grok/skills/` when `.claude/skills/` already has them
- Invent a second knowledge home
