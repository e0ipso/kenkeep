import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ClaudeAdapter } from '../adapters/claude.js';
import {
  runBootstrapIncremental,
  type BootstrapContext,
  type BootstrapRunner,
} from '../lib/bootstrap.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';

export interface BootstrapIncrementalOptions {
  from: string;
  include?: string[];
  exclude?: string[];
  dryRun?: boolean;
  tokenBudget?: number;
  timeoutMs?: number;
}

export async function runBootstrapIncrementalCommand(
  opts: BootstrapIncrementalOptions,
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.',
    );
    return 1;
  }

  const sourceDir = resolve(root, opts.from);
  if (!existsSync(sourceDir)) {
    log.error(`Source path not found: ${sourceDir}`);
    return 1;
  }

  const promptTemplate = loadBootstrapPrompt(paths.builderDir);
  if (!promptTemplate) {
    log.error('Bootstrap-incremental prompt template not found.');
    return 1;
  }

  const adapter = new ClaudeAdapter();
  const runner: BootstrapRunner = (prompt, stdin, schema, runnerOpts) =>
    adapter.runHeadless(prompt, stdin, schema, runnerOpts);

  const ctx: BootstrapContext = {
    sourceDir,
    repoRoot: root,
    kbDir: paths.kbDir,
    proposedDir: paths.proposedDir,
    logsDir: paths.logsDir,
    stateFile: join(paths.builderDir, 'state.json'),
    bootstrapStateFile: join(paths.builderDir, 'bootstrap-state.json'),
    promptTemplate,
    runner,
  };
  if (opts.include !== undefined) ctx.include = opts.include;
  if (opts.exclude !== undefined) ctx.exclude = opts.exclude;
  if (opts.dryRun) ctx.dryRun = true;
  if (opts.tokenBudget !== undefined) ctx.tokenBudget = opts.tokenBudget;
  if (opts.timeoutMs !== undefined) ctx.timeoutMs = opts.timeoutMs;

  log.info(
    opts.dryRun
      ? `Bootstrap incremental (dry-run) scanning ${sourceDir}…`
      : `Bootstrap incremental processing ${sourceDir}…`,
  );

  const result = await runBootstrapIncremental(ctx);

  switch (result.status) {
    case 'locked':
      log.warn(`Bootstrap is locked: ${result.reason ?? 'another run holds the lock'}.`);
      return 0;
    case 'no-docs':
      log.success(`No markdown files matched under ${sourceDir}.`);
      return 0;
    case 'completed': {
      const toProcess = result.processed.filter((p) => p.status !== 'unchanged').length;
      if (opts.dryRun) {
        log.success(
          `Dry-run: ${toProcess} file(s) would be processed in ${result.batches} batch(es); ${result.unchanged} unchanged.`,
        );
        for (const p of result.processed) {
          if (p.status === 'skipped-dry-run') log.plain(`  + ${p.relPath}`);
        }
        return 0;
      }
      log.success(
        `Bootstrap finished: ${result.proposalsWritten} proposal(s) across ${result.batches} batch(es); ` +
          `${toProcess} processed, ${result.unchanged} unchanged.`,
      );
      if (result.runId) log.plain(`Run id: ${result.runId}`);
      const failures = result.processed.filter((p) => p.status === 'failed');
      if (failures.length > 0) {
        log.warn(`${failures.length} file(s) failed to process; see logs for details.`);
        for (const f of failures) log.plain(`  ! ${f.relPath}: ${f.error ?? 'unknown error'}`);
      }
      log.plain('Review the proposals with `ai-knowledge-base proposals review`.');
      return 0;
    }
  }
}

function loadBootstrapPrompt(builderDir: string): string | null {
  const local = join(builderDir, 'prompts', 'bootstrap-incremental.md');
  if (existsSync(local)) return readFileSync(local, 'utf8');
  const fallback = join(packageTemplatesDir(), 'prompts', 'bootstrap-incremental.md');
  if (existsSync(fallback)) return readFileSync(fallback, 'utf8');
  return null;
}
