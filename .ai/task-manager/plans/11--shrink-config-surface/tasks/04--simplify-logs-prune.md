---
id: 4
group: "logs-prune"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Collapse `logs prune` to a 30-day blanket cleanup

## Objective

Replace the 135-line `logs-prune` machinery (bucket reports, byte accounting, seven-suffix duration parser) with a single function that recursively deletes `*.jsonl` files older than `settings.logsRetentionDays` (default 30) under the whole `_logs/` tree, and a CLI command with no flags that prints `pruned N files`.

## Skills Required

- `typescript`: edit `src/lib/logs-prune.ts` and `src/commands/logs-prune.ts`.

## Acceptance Criteria

- [ ] `src/lib/logs-prune.ts` exports one function: `pruneLogs({ logsDir, cutoffMs }: { logsDir: string; cutoffMs: number }): { filesDeleted: number }`.
- [ ] The function recursively walks `logsDir`, deletes any regular file ending in `.jsonl` whose `mtimeMs < cutoffMs`, and returns the count deleted. Missing `logsDir` returns `{ filesDeleted: 0 }`. Per-file `stat`/`unlink` errors are swallowed (continue to next file), consistent with current behavior.
- [ ] `parseDurationMs`, `formatBytes`, `LOG_BUCKETS`, `BucketReport`, `PruneResult`, `PruneOptions`, `DURATION_UNITS`, `LogBucket`, and the `dryRun`/`now` parameters are all deleted.
- [ ] `src/commands/logs-prune.ts`: `LogsPruneOptions` becomes `{}` (or the file no longer declares it). No `--older-than`, no `--dry-run`. The command reads `settings.logsRetentionDays`, computes `cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000`, calls `pruneLogs`, and logs `pruned ${filesDeleted} files`.
- [ ] `src/cli.ts`: the `logs prune` subcommand definition has no `--older-than` or `--dry-run` options.
- [ ] `rg -n "parseDurationMs|formatBytes|LOG_BUCKETS|BucketReport|PruneResult|DURATION_UNITS" src` returns zero hits.
- [ ] `npm run build` succeeds.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Use `node:fs` (`existsSync`, `readdirSync` with `withFileTypes: true`, `statSync`, `unlinkSync`) and `node:path` (`join`). No new deps.
- Recursive walk must follow real directories only; symlinks should not be followed (use `dirent.isDirectory()` from `readdirSync({ withFileTypes: true })`).

## Input Dependencies

Task 1 (settings shape).
Task 2 (warnings loop removal from `commands/logs-prune.ts` — task 4 then rewrites the rest of that file).

## Output Artifacts

`src/lib/logs-prune.ts` and `src/commands/logs-prune.ts` rewritten; CLI subcommand definition trimmed.

## Implementation Notes

<details>
<summary>Reference implementation</summary>

`src/lib/logs-prune.ts`:
```ts
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export function pruneLogs(opts: { logsDir: string; cutoffMs: number }): { filesDeleted: number } {
  let filesDeleted = 0;
  if (!existsSync(opts.logsDir)) return { filesDeleted };
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      let info;
      try { info = statSync(full); } catch { continue; }
      if (info.mtimeMs >= opts.cutoffMs) continue;
      try { unlinkSync(full); filesDeleted += 1; } catch { /* ignore */ }
    }
  };
  walk(opts.logsDir);
  return { filesDeleted };
}
```

`src/commands/logs-prune.ts`:
```ts
import { existsSync } from 'node:fs';
import { log } from '../lib/log.js';
import { pruneLogs } from '../lib/logs-prune.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export async function runLogsPrune(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error('ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.');
    return 1;
  }
  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const cutoffMs = Date.now() - settings.logsRetentionDays * 24 * 60 * 60 * 1000;
  const { filesDeleted } = pruneLogs({ logsDir: paths.logsDir, cutoffMs });
  log.info(`pruned ${filesDeleted} files`);
  return 0;
}
```

`src/cli.ts`: locate the `.command('logs prune')` block (or however the subcommand is registered) and remove the `.option('--older-than ...')` and `.option('--dry-run ...')` chains. Update the action callback signature to take no opts.

</details>
