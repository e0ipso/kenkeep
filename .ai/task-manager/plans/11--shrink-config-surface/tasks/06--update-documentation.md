---
id: 6
group: "docs"
dependencies: [2, 3, 4]
status: "completed"
created: 2026-05-13
skills:
  - technical-writing
---
# Update README, CHANGELOG, PRD, IMPLEMENTATION, and AGENTS to match the new config surface

## Objective

Trim user-facing and internal docs to the new schema (3 numeric knobs + 3 model keys), the single-file project config layout, the count-based batching, and the no-flag `logs prune`. Record the breaking schema change in the CHANGELOG. No retrospective framing outside CHANGELOG.

## Skills Required

- `technical-writing`: edit existing Markdown docs without introducing em-dashes (per repo style) or retrospective wording.

## Acceptance Criteria

- [ ] `README.md`: the `config.yaml` example shows only `schema_version`, `curationThreshold`, `logsRetentionDays`, `lintEveryNSessions`. No mention of `~/.config/ai-knowledge-base/config.yaml`, `XDG_CONFIG_HOME`, or any user-level override. The `logs prune` reference documents no flags. Any list of "settings keys" is trimmed to the retained six (3 numeric + 3 model).
- [ ] `CHANGELOG.md`: under the next version's `### Removed` (or equivalent), list `drainBound`, `maxAttempts`, `proposalTimeout`, `lockTtlMs`, `bootstrapTokenBudget`, the user-level XDG config file, the `warnings` array returned by `resolveSettings`, and the `--older-than` / `--dry-run` flags on `logs prune`. Under `### Changed`, note that the project `config.yaml` is now strict against unknown keys and a malformed file fails loudly. Mention that on-disk configs holding the removed keys must be hand-edited.
- [ ] `PRD.md` and `IMPLEMENTATION.md`: no remaining references to the removed settings, the user-level config layer, token budgeting (`tokenBudget`, `CHARS_PER_TOKEN`), `formatBytes`, `parseDurationMs`, log buckets, or `--older-than`/`--dry-run`. References to settings list the retained keys.
- [ ] `AGENTS.md`: if it references settings or `config.yaml`, the reference matches the new shape. If it does not reference settings, no change.
- [ ] Style: no em-dashes (`—`), no en-dashes (`–`) as separators, no ` - ` as a sentence-level dash. Use commas, colons, or parentheses. No "previously X did Y" wording outside CHANGELOG.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Use `rg` to find every mention of removed identifiers, then edit in place.
- The `.ai/task-manager/scratch/over-engineering/` directory is intentionally not updated.

## Input Dependencies

Tasks 2, 3, 4 (source must match the doc claims).

## Output Artifacts

Updated docs that match the implemented surface.

## Implementation Notes

<details>
<summary>Suggested search-and-edit checklist</summary>

```
rg -n "drainBound|maxAttempts|proposalTimeout|lockTtlMs|bootstrapTokenBudget" README.md PRD.md IMPLEMENTATION.md AGENTS.md CHANGELOG.md
rg -n "XDG_CONFIG_HOME|~/.config/ai-knowledge-base|user-level" README.md PRD.md IMPLEMENTATION.md AGENTS.md
rg -n "tokenBudget|CHARS_PER_TOKEN|chunkDocs|batchSessions" README.md PRD.md IMPLEMENTATION.md AGENTS.md
rg -n "older-than|--dry-run|parseDurationMs|formatBytes|LOG_BUCKETS" README.md PRD.md IMPLEMENTATION.md AGENTS.md
```

Resolve every hit. Where the removed feature was a section, delete the section instead of leaving a stub.

CHANGELOG entry sketch:

```
## Unreleased

### Removed
- `SettingsSchema` keys: `drainBound`, `maxAttempts`, `proposalTimeout`, `lockTtlMs`, `bootstrapTokenBudget`. On-disk `config.yaml` files holding any of these must be hand-edited; the strict schema rejects unknown keys.
- User-level `config.yaml` at `~/.config/ai-knowledge-base/config.yaml` (`XDG_CONFIG_HOME` lookup). Project-level `config.yaml` is now the only configuration file.
- `warnings` array returned by `resolveSettings`. Malformed YAML or schema violations now throw an `Error` naming the offending file.
- `logs prune --older-than` and `logs prune --dry-run` flags. The command now always uses `settings.logsRetentionDays` (default 30) and prints `pruned N files`.
- Token-budget batching in bootstrap and curate: `CHARS_PER_TOKEN`, `DEFAULT_TOKEN_BUDGET`, `chunkDocs`, `batchSessions`, `estimateSessionTokens`, and the `--token-budget` CLI flag.

### Changed
- Bootstrap batches docs in groups of 20, curate batches sessions in groups of 10, via the new `chunk(items, size)` helper in `src/lib/chunk-batch.ts`.
- `logs prune` walks the whole `_logs/` tree (recursively) and deletes `*.jsonl` files older than `settings.logsRetentionDays`.
```

</details>
