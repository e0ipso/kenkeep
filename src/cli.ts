import { Command } from 'commander';
import { runBootstrapIncrementalCommand } from './commands/bootstrap-incremental.js';
import { runCurateCommand } from './commands/curate.js';
import { runDoctor } from './commands/doctor.js';
import { runIndexRebuild } from './commands/index-rebuild.js';
import { runInit } from './commands/init.js';
import { runLogsPrune } from './commands/logs-prune.js';
import { runNodeAdd } from './commands/node-add.js';
import { runStatus } from './commands/status.js';
import { log } from './lib/log.js';
import { packageVersion } from './lib/version.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('ai-knowledge-base')
    .description('Build and maintain a per-repo knowledge base from AI coding sessions.')
    .version(packageVersion());

  program
    .command('init')
    .description('First-time setup: copy templates, install pre-commit hook, record version.')
    .requiredOption(
      '-a, --assistants <list>',
      'comma-separated list of assistants to wire up (v1 supports: claude)',
      (value: string) =>
        value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
    )
    .option('-f, --force', 'overwrite existing ai-knowledge-base files', false)
    .option(
      '-u, --upgrade',
      'refresh hooks/slash commands/prompts to the current package version while preserving local overrides and config.yaml',
      false
    )
    .option('--dry-run', 'with --upgrade: list planned changes without writing', false)
    .action(
      async (opts: {
        assistants: string[];
        force?: boolean;
        upgrade?: boolean;
        dryRun?: boolean;
      }) => {
        const initOpts: {
          assistants: string[];
          force?: boolean;
          upgrade?: boolean;
          dryRun?: boolean;
        } = { assistants: opts.assistants };
        if (opts.force) initOpts.force = true;
        if (opts.upgrade) initOpts.upgrade = true;
        if (opts.dryRun) initOpts.dryRun = true;
        await runInit(initOpts);
      }
    );

  program
    .command('status')
    .description('Show pending session logs, pending curator conflicts, and KB stats.')
    .action(async () => {
      await runStatus();
    });

  program
    .command('doctor')
    .description('Verify hook installation, secret-scan availability, and schema validity.')
    .option('-v, --verbose', 'show extra diagnostics', false)
    .action(async (opts: { verbose?: boolean }) => {
      const doctorOpts: { verbose?: boolean } = {};
      if (opts.verbose) doctorOpts.verbose = true;
      const code = await runDoctor(doctorOpts);
      process.exit(code);
    });

  program
    .command('curate')
    .description('Run the curator non-interactively over pending session logs.')
    .option('--batch-size <n>', 'sessions per curator batch (default 10)', v => parseInt(v, 10))
    .option('--token-budget <n>', 'approx token budget per batch (default 50000)', v =>
      parseInt(v, 10)
    )
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', v => parseInt(v, 10))
    .action(async (opts: { batchSize?: number; tokenBudget?: number; timeout?: number }) => {
      const curateOpts: { batchSize?: number; tokenBudget?: number; timeoutMs?: number } = {};
      if (typeof opts.batchSize === 'number' && !Number.isNaN(opts.batchSize))
        curateOpts.batchSize = opts.batchSize;
      if (typeof opts.tokenBudget === 'number' && !Number.isNaN(opts.tokenBudget))
        curateOpts.tokenBudget = opts.tokenBudget;
      if (typeof opts.timeout === 'number' && !Number.isNaN(opts.timeout))
        curateOpts.timeoutMs = opts.timeout;
      const code = await runCurateCommand(curateOpts);
      process.exit(code);
    });

  program
    .command('bootstrap-incremental')
    .description(
      'Incrementally bootstrap the KB from markdown docs under --from; processes only files whose content hash changed since last run.'
    )
    .requiredOption('--from <path>', 'directory (or file) to scan for markdown documentation')
    .option(
      '--include <glob>',
      'glob to whitelist files (relative to repo root, repeatable)',
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[]
    )
    .option(
      '--exclude <glob>',
      'glob to skip files (relative to repo root, repeatable)',
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[]
    )
    .option('--dry-run', 'report what would be processed without invoking the LLM', false)
    .option('--token-budget <n>', 'approx token budget per batch (default 10000)', v =>
      parseInt(v, 10)
    )
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', v => parseInt(v, 10))
    .action(
      async (opts: {
        from: string;
        include: string[];
        exclude: string[];
        dryRun?: boolean;
        tokenBudget?: number;
        timeout?: number;
      }) => {
        const cmdOpts: {
          from: string;
          include?: string[];
          exclude?: string[];
          dryRun?: boolean;
          tokenBudget?: number;
          timeoutMs?: number;
        } = { from: opts.from };
        if (opts.include.length > 0) cmdOpts.include = opts.include;
        if (opts.exclude.length > 0) cmdOpts.exclude = opts.exclude;
        if (opts.dryRun) cmdOpts.dryRun = true;
        if (typeof opts.tokenBudget === 'number' && !Number.isNaN(opts.tokenBudget))
          cmdOpts.tokenBudget = opts.tokenBudget;
        if (typeof opts.timeout === 'number' && !Number.isNaN(opts.timeout))
          cmdOpts.timeoutMs = opts.timeout;
        const code = await runBootstrapIncrementalCommand(cmdOpts);
        process.exit(code);
      }
    );

  const nodeGroup = program.command('node').description('Manage knowledge-base nodes.');
  nodeGroup
    .command('add')
    .description('Interactively draft a new node; writes directly to nodes/<kind>/<id>.md.')
    .action(async () => {
      const code = await runNodeAdd();
      process.exit(code);
    });

  const indexGroup = program.command('index').description('Manage INDEX.md and GRAPH.md.');
  indexGroup
    .command('rebuild')
    .description('Regenerate INDEX.md and GRAPH.md from the current nodes/ tree (deterministic).')
    .option('--budget-tokens <n>', 'INDEX.md token budget (default 2000)', v => parseInt(v, 10))
    .option(
      '--stage',
      'after writing, `git add` INDEX.md and GRAPH.md (no-op outside a git repo)',
      false
    )
    .allowExcessArguments(true)
    .action(async (opts: { budgetTokens?: number; stage?: boolean }) => {
      const rebuildOpts: { budgetTokens?: number; stage?: boolean } = {};
      if (typeof opts.budgetTokens === 'number' && !Number.isNaN(opts.budgetTokens))
        rebuildOpts.budgetTokens = opts.budgetTokens;
      if (opts.stage) rebuildOpts.stage = true;
      const code = await runIndexRebuild(rebuildOpts);
      process.exit(code);
    });

  const logsGroup = program.command('logs').description('Manage stream-json log files.');
  logsGroup
    .command('prune')
    .description(
      'Delete JSONL log files under .ai/knowledge-base/_logs/ older than a duration (default: 30d or settings.logsRetentionDays).'
    )
    .option(
      '--older-than <duration>',
      "ms-style duration (e.g. '30d', '2w', '12h'); files older than this are deleted"
    )
    .option('--dry-run', 'list what would be deleted without touching files', false)
    .action(async (opts: { olderThan?: string; dryRun?: boolean }) => {
      const pruneOpts: { olderThan?: string; dryRun?: boolean } = {};
      if (typeof opts.olderThan === 'string') pruneOpts.olderThan = opts.olderThan;
      if (opts.dryRun) pruneOpts.dryRun = true;
      const code = await runLogsPrune(pruneOpts);
      process.exit(code);
    });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    log.error(err.message);
  } else {
    log.error(String(err));
  }
  process.exit(1);
});
