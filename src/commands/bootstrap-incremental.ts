import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  runBootstrapIncremental,
  type BootstrapContext,
  type BootstrapRunner,
} from '../lib/bootstrap.js';
import { resolveActiveHarness } from '../harnesses/detect.js';
import type { HeadlessRunOptions } from '../harnesses/types.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export interface BootstrapIncrementalOptions {
  from: string;
  include?: string[] | undefined;
  exclude?: string[] | undefined;
  dryRun?: boolean | undefined;
  timeoutMs?: number | undefined;
}

export async function runBootstrapIncrementalCommand(
  opts: BootstrapIncrementalOptions
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `npx @e0ipso/ai-knowledge-base init --assistants claude`.'
    );
    return 1;
  }

  const sourceDir = resolve(root, opts.from);
  if (!existsSync(sourceDir)) {
    log.error(`Source path not found: ${sourceDir}`);
    return 1;
  }

  const promptTemplate = loadBootstrapPrompt(paths.promptsDir);
  if (!promptTemplate) {
    log.error('Bootstrap-incremental prompt template not found.');
    return 1;
  }

  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const harness = resolveActiveHarness({ cliDefault: settings.cliDefaultHarness });
  const runner: BootstrapRunner = (prompt, stdin, schema, runnerOpts) =>
    harness.runHeadless(prompt, stdin, schema, runnerOpts as HeadlessRunOptions);

  const ctx: BootstrapContext = {
    sourceDir,
    paths,
    promptTemplate,
    runner,
    ...(opts.include !== undefined ? { include: opts.include } : {}),
    ...(opts.exclude !== undefined ? { exclude: opts.exclude } : {}),
    ...(opts.dryRun ? { dryRun: true } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    ...(settings.bootstrapModel
      ? { model: settings.bootstrapModel.name, effort: settings.bootstrapModel.effort }
      : {}),
  };

  log.info(
    opts.dryRun
      ? `Bootstrap incremental (dry-run) scanning ${sourceDir}…`
      : `Bootstrap incremental processing ${sourceDir}…`
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
      const toProcess = result.processed.filter(p => p.status !== 'unchanged').length;
      if (opts.dryRun) {
        log.success(
          `Dry-run: ${toProcess} file(s) would be processed in ${result.batches} batch(es); ${result.unchanged} unchanged.`
        );
        for (const p of result.processed) {
          if (p.status === 'skipped-dry-run') log.plain(`  + ${p.relPath}`);
        }
        return 0;
      }
      log.success(
        `Bootstrap finished: ${result.nodesWritten} node(s) written across ${result.batches} batch(es); ` +
          `${toProcess} processed, ${result.unchanged} unchanged` +
          (result.skippedCollisions > 0
            ? `, ${result.skippedCollisions} skipped (target node already exists)`
            : '') +
          '.'
      );
      log.plain(`Run id: ${result.runId}`);
      const failures = result.processed.filter(p => p.status === 'failed');
      if (failures.length > 0) {
        log.warn(`${failures.length} file(s) failed to process; see logs for details.`);
        for (const f of failures) log.plain(`  ! ${f.relPath}: ${f.error ?? 'unknown error'}`);
      }
      log.plain('Review new nodes with `git diff nodes/` before committing.');
      return 0;
    }
  }
}

function loadBootstrapPrompt(promptsDir: string): string | null {
  const local = join(promptsDir, 'bootstrap-incremental.md');
  if (existsSync(local)) return readFileSync(local, 'utf8');
  const fallback = join(packageTemplatesDir(), 'prompts', 'bootstrap-incremental.md');
  if (existsSync(fallback)) return readFileSync(fallback, 'utf8');
  return null;
}
