import { Command } from 'commander';
import { runBootstrapIncrementalCommand } from './commands/bootstrap-incremental.js';
import { runCurateCommand } from './commands/curate.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runNodeAdd } from './commands/node-add.js';
import { runProposalsReview } from './commands/proposals-review.js';
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
          .map((s) => s.trim())
          .filter(Boolean),
    )
    .option('-f, --force', 'overwrite existing ai-knowledge-base files', false)
    .action(async (opts: { assistants: string[]; force?: boolean }) => {
      const initOpts: { assistants: string[]; force?: boolean } = { assistants: opts.assistants };
      if (opts.force) initOpts.force = true;
      await runInit(initOpts);
    });

  program
    .command('status')
    .description('Show pending session logs, pending proposals, and KB stats.')
    .action(async () => {
      await runStatus();
    });

  program
    .command('doctor')
    .description('Verify hook installation, gitleaks availability, and schema validity.')
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
    .option('--batch-size <n>', 'sessions per curator batch (default 10)', (v) => parseInt(v, 10))
    .option('--token-budget <n>', 'approx token budget per batch (default 50000)', (v) =>
      parseInt(v, 10),
    )
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', (v) =>
      parseInt(v, 10),
    )
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
      'Incrementally bootstrap the KB from markdown docs under --from; processes only files whose content hash changed since last run.',
    )
    .requiredOption('--from <path>', 'directory (or file) to scan for markdown documentation')
    .option(
      '--include <glob>',
      'glob to whitelist files (relative to repo root, repeatable)',
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option(
      '--exclude <glob>',
      'glob to skip files (relative to repo root, repeatable)',
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .option('--dry-run', 'report what would be processed without invoking the LLM', false)
    .option('--token-budget <n>', 'approx token budget per batch (default 10000)', (v) =>
      parseInt(v, 10),
    )
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', (v) =>
      parseInt(v, 10),
    )
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
      },
    );

  const nodeGroup = program.command('node').description('Manage knowledge-base nodes.');
  nodeGroup
    .command('add')
    .description('Interactively draft a new node; writes a proposal under _proposed/additions/.')
    .action(async () => {
      const code = await runNodeAdd();
      process.exit(code);
    });

  const proposalsGroup = program
    .command('proposals')
    .description('Inspect and review pending proposals.');
  proposalsGroup
    .command('review')
    .description('Interactively accept, reject, or set the resolution of pending proposals.')
    .option('--list', 'just list the proposals without prompting', false)
    .action(async (opts: { list?: boolean }) => {
      const reviewOpts: { list?: boolean } = {};
      if (opts.list) reviewOpts.list = true;
      const code = await runProposalsReview(reviewOpts);
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
