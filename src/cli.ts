import { Command } from 'commander';
import { runBootstrapIncrementalCommand } from './commands/bootstrap-incremental.js';
import { runCurateCommand } from './commands/curate.js';
import { runDoctor } from './commands/doctor.js';
import { runIndexRebuild } from './commands/index-rebuild.js';
import { runInit } from './commands/init.js';
import { runLintCommand } from './commands/lint.js';
import { runLogsPrune } from './commands/logs-prune.js';
import { runNodeAdd } from './commands/node-add.js';
import { runStatus } from './commands/status.js';
import { intArg } from './lib/cli-args.js';
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
    .action(
      async (opts: {
        assistants: string[];
        force: boolean;
        upgrade: boolean;
      }) => {
        await runInit(opts);
      }
    );

  program
    .command('status')
    .description('Show pending session logs and KB stats.')
    .action(async () => {
      await runStatus();
    });

  program
    .command('doctor')
    .description('Verify hook installation, secret-scan availability, and schema validity.')
    .option('-v, --verbose', 'show extra diagnostics', false)
    .action(async (opts: { verbose: boolean }) => {
      const code = await runDoctor(opts);
      process.exit(code);
    });

  program
    .command('lint')
    .description(
      'Run mechanical KB content health checks (dangling edges, slug/id mismatch, tag duplicates, orphans).'
    )
    .option('-v, --verbose', 'list every error and finding individually', false)
    .action(async (opts: { verbose: boolean }) => {
      const code = await runLintCommand({ verbose: opts.verbose });
      process.exit(code);
    });

  program
    .command('curate')
    .description('Run the curator non-interactively over pending session logs.')
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', intArg('--timeout'))
    .action(async (opts: { timeout?: number }) => {
      const code = await runCurateCommand({ timeoutMs: opts.timeout });
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
    .option('--timeout <ms>', 'per-batch subprocess timeout (default 120000)', intArg('--timeout'))
    .action(
      async (opts: {
        from: string;
        include: string[];
        exclude: string[];
        dryRun: boolean;
        timeout?: number;
      }) => {
        const code = await runBootstrapIncrementalCommand({
          from: opts.from,
          include: opts.include,
          exclude: opts.exclude,
          dryRun: opts.dryRun,
          timeoutMs: opts.timeout,
        });
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
    .option(
      '--stage',
      'after writing, `git add` INDEX.md and GRAPH.md (no-op outside a git repo)',
      false
    )
    .allowExcessArguments(true)
    .action(async (opts: { stage: boolean }) => {
      const code = await runIndexRebuild(opts);
      process.exit(code);
    });

  const logsGroup = program.command('logs').description('Manage stream-json log files.');
  logsGroup
    .command('prune')
    .description(
      'Delete JSONL log files under .ai/knowledge-base/_logs/ older than settings.logsRetentionDays (default 30 days).'
    )
    .action(async () => {
      const code = await runLogsPrune();
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
