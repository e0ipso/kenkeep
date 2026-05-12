import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeAdapter } from '../adapters/claude.js';
import { runCurate, type CuratorRunner } from '../lib/curate.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { type ConflictReport, type PendingConflictsFile } from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';

export interface CurateCommandOptions {
  batchSize?: number;
  tokenBudget?: number;
  timeoutMs?: number;
}

export async function runCurateCommand(opts: CurateCommandOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.'
    );
    return 1;
  }

  const promptTemplate = loadCuratorPrompt(paths.promptsDir);
  if (!promptTemplate) {
    log.error('Curator prompt template not found.');
    return 1;
  }

  const adapter = new ClaudeAdapter();
  const runner: CuratorRunner = (prompt, stdin, schema, runnerOpts) =>
    adapter.runHeadless(prompt, stdin, schema, runnerOpts);

  log.info('Curating pending session logs…');
  const { settings, warnings } = resolveSettings({ projectFile: paths.projectConfigFile });
  for (const w of warnings) log.warn(w);
  const baseOpts = {
    kbDir: paths.kbDir,
    sessionsDir: paths.sessionsDir,
    nodesDir: paths.nodesDir,
    logsDir: paths.logsDir,
    stateFile: join(paths.stateDir, 'state.json'),
    promptTemplate,
    runner,
    lockTtlMs: settings.lockTtlMs,
    indexBudgetTokens: settings.indexBudgetTokens,
  };
  const result = await runCurate({
    ...baseOpts,
    ...(opts.batchSize !== undefined ? { batchSize: opts.batchSize } : {}),
    ...(opts.tokenBudget !== undefined ? { tokenBudget: opts.tokenBudget } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });

  // Always (re)write the side-channel so a completed run with zero conflicts
  // clears any stale entries from a previous run.
  writePendingConflicts(join(paths.stateDir, 'pending-conflicts.json'), result.conflicts);

  switch (result.status) {
    case 'locked':
      log.warn(`Curator is locked: ${result.reason ?? 'another run holds the lock'}.`);
      return 0;
    case 'no-pending':
      log.success('No pending session logs. INDEX and GRAPH regenerated.');
      return 0;
    case 'completed':
      log.success(
        `Curator finished: ${result.nodesWritten} node(s) written, ${result.drops} drop(s) over ${result.batches} batch(es).`
      );
      log.plain(`Run id: ${result.runId ?? '(unknown)'}`);
      if (result.failures.length > 0) {
        log.warn(`${result.failures.length} action(s) failed:`);
        for (const f of result.failures) log.plain(`  ! [${f.reason}] ${f.detail}`);
      }
      if (result.conflicts.length > 0) {
        log.warn(
          `${result.conflicts.length} contradiction(s) require resolution; see ` +
            '`.ai/knowledge-base/.state/pending-conflicts.json` (the kb-curate skill resolves these in-session).'
        );
      }
      log.plain('Review changed files with `git diff nodes/` before committing.');
      return 0;
  }
}

function writePendingConflicts(file: string, conflicts: ConflictReport[]): void {
  mkdirSync(join(file, '..'), { recursive: true });
  const payload: PendingConflictsFile = { schema_version: 1, conflicts };
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function loadCuratorPrompt(promptsDir: string): string | null {
  const local = join(promptsDir, 'curator.md');
  if (existsSync(local)) return readFileSync(local, 'utf8');
  const fallback = join(packageTemplatesDir(), 'prompts', 'curator.md');
  if (existsSync(fallback)) return readFileSync(fallback, 'utf8');
  return null;
}
