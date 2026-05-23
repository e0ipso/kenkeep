import { Command } from 'commander';
import { runBootstrapLauncher } from './commands/bootstrap.js';
import { runCurateLauncher } from './commands/curate.js';
import { runCurateDedupCommand } from './commands/curate-dedup.js';
import { runDoctor } from './commands/doctor.js';
import { runFindDocsCommand } from './commands/finddocs.js';
import { runIndexRebuild } from './commands/index-rebuild.js';
import { runInit } from './commands/init.js';
import { runLintCommand } from './commands/lint.js';
import { runLogsPrune } from './commands/logs-prune.js';
import { runNodeAddLauncher } from './commands/node-add.js';
import { runNodeWriteCommand } from './commands/node-write.js';
import { runStatus } from './commands/status.js';
import { listHarnessIds } from './harnesses/registry.js';
import { log } from './lib/log.js';
import { packageVersion } from './lib/version.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('ai-knowledge-base')
    .description('Build and maintain a per-repo knowledge base from AI coding sessions.')
    .version(packageVersion())
    .option(
      '--harness <id>',
      `select the active harness adapter for this invocation (one of: ${listHarnessIds().join(', ')})`
    );

  const getHarnessFlag = (): string | undefined => {
    const value = program.opts<{ harness?: string }>().harness;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };

  program
    .command('init')
    .description('First-time setup: copy templates, register harness hooks, record version.')
    .requiredOption(
      '-h, --harnesses <list>',
      `comma-separated list of harnesses to wire up (supported: ${listHarnessIds().join(', ')})`,
      (value: string) =>
        value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
    )
    .option(
      '-u, --upgrade',
      'refresh hooks/slash commands/prompts to the current package version while preserving local overrides and config.yaml',
      false
    )
    .action(async (opts: { harnesses: string[]; upgrade: boolean }) => {
      await runInit(opts);
    });

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
      const code = await runDoctor({ ...opts, harness: program.opts().harness });
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
    .description(
      'Launch the kb-curate skill in the active harness (execs `<harness> -p "/kb-curate"`).'
    )
    .action(() => {
      const launchOpts: Parameters<typeof runCurateLauncher>[0] = {};
      const harnessFlag = getHarnessFlag();
      if (harnessFlag !== undefined) launchOpts.harness = harnessFlag;
      runCurateLauncher(launchOpts);
    });

  program
    .command('curate-dedup')
    .description(
      'Deterministic curator dedup primitive: validates a proposals JSON (--input or stdin), dedups, mints conflict ids, writes conflict files and stamps consumed session logs. Pure Node — no LLM.'
    )
    .option(
      '--input <path>',
      'path to proposals JSON (CuratorOutputSchema); reads stdin when omitted'
    )
    .option('--output <path>', 'write deduped surviving (non-conflict) actions to this JSON file')
    .option('--run-id <id>', 'caller-supplied run id (defaults to a fresh randomUUID)')
    .option('--sessions-dir <path>', 'override the _sessions directory (defaults to repo paths)')
    .option('--conflicts-dir <path>', 'override the conflicts directory (defaults to repo paths)')
    .action(
      async (opts: {
        input?: string;
        output?: string;
        runId?: string;
        sessionsDir?: string;
        conflictsDir?: string;
      }) => {
        const flags: Parameters<typeof runCurateDedupCommand>[0] = {};
        if (opts.input !== undefined) flags.input = opts.input;
        if (opts.output !== undefined) flags.output = opts.output;
        if (opts.runId !== undefined) flags.runId = opts.runId;
        if (opts.sessionsDir !== undefined) flags.sessionsDir = opts.sessionsDir;
        if (opts.conflictsDir !== undefined) flags.conflictsDir = opts.conflictsDir;
        const code = await runCurateDedupCommand(flags);
        process.exit(code);
      }
    );

  program
    .command('bootstrap')
    .description(
      'Launch the kb-bootstrap skill in the active harness (execs `<harness> -p "/kb-bootstrap …"`). Scope is controlled by .kbignore plus an optional --from <scope>.'
    )
    .option(
      '--from <scope>',
      'narrow discovery to a subdirectory of the repo root (path relative to repo root)'
    )
    .action((opts: { from?: string }) => {
      const launchOpts: Parameters<typeof runBootstrapLauncher>[0] = {};
      if (opts.from !== undefined) launchOpts.from = opts.from;
      const harnessFlag = getHarnessFlag();
      if (harnessFlag !== undefined) launchOpts.harness = harnessFlag;
      runBootstrapLauncher(launchOpts);
    });

  // Deprecation alias for one release. Same behavior as `bootstrap`, but
  // writes a stderr notice pointing at the new name. Help text mentions
  // `[deprecated]` so users running `bootstrap-incremental --help`
  // discover the rename.
  program
    .command('bootstrap-incremental')
    .description(
      '[deprecated] Alias for `bootstrap`; will be removed in the next release. Use `ai-knowledge-base bootstrap` instead.'
    )
    .option(
      '--from <scope>',
      'narrow discovery to a subdirectory of the repo root (path relative to repo root)'
    )
    .action((opts: { from?: string }) => {
      process.stderr.write(
        "[deprecated] use 'ai-knowledge-base bootstrap' instead of 'bootstrap-incremental'\n"
      );
      const launchOpts: Parameters<typeof runBootstrapLauncher>[0] = {};
      if (opts.from !== undefined) launchOpts.from = opts.from;
      const harnessFlag = getHarnessFlag();
      if (harnessFlag !== undefined) launchOpts.harness = harnessFlag;
      runBootstrapLauncher(launchOpts);
    });

  const nodeGroup = program.command('node').description('Manage knowledge-base nodes.');
  nodeGroup
    .command('add')
    .description(
      'Launch the kb-add skill in the active harness (execs `<harness> -p "/kb-add"`). The skill collects kind/title/summary/body/tags interactively and persists via the `node write` primitive.'
    )
    .action(() => {
      const launchOpts: Parameters<typeof runNodeAddLauncher>[0] = {};
      const harnessFlag = getHarnessFlag();
      if (harnessFlag !== undefined) launchOpts.harness = harnessFlag;
      runNodeAddLauncher(launchOpts);
    });
  nodeGroup
    .command('write')
    .description(
      'Headless primitive: atomically write a single node to nodes/<kind>/<id>.md with Zod-validated frontmatter and slug-collision resolution. Body read from stdin (default) or --from <path>. Prints the resolved id to stdout. When both --source-doc and --source-hash are passed, also updates bootstrap-state.json per-file hash map.'
    )
    .argument('<kind>', 'node kind: practice or map')
    .argument('<slug>', 'proposed id base (kind prefix added automatically when missing)')
    .option('--title <title>', 'short title (≤ 80 chars)')
    .option('--summary <summary>', 'one-line summary (≤ 140 chars)')
    .option('--tags <list>', 'comma-separated tags')
    .option('--relates-to <list>', 'comma-separated node ids')
    .option('--confidence <level>', 'low, medium, or high (default: high)')
    .option('--from <path>', 'read body from <path> instead of stdin')
    .option('--source-doc <relpath>', 'source markdown doc (repo-relative); requires --source-hash')
    .option('--source-hash <sha256>', 'sha256 hex digest of --source-doc; requires --source-doc')
    .action(
      async (
        kind: string,
        slug: string,
        opts: {
          title?: string;
          summary?: string;
          tags?: string;
          relatesTo?: string;
          confidence?: string;
          from?: string;
          sourceDoc?: string;
          sourceHash?: string;
        }
      ) => {
        const flags: Parameters<typeof runNodeWriteCommand>[0]['flags'] = {};
        if (opts.title !== undefined) flags.title = opts.title;
        if (opts.summary !== undefined) flags.summary = opts.summary;
        if (opts.tags !== undefined) flags.tags = opts.tags;
        if (opts.relatesTo !== undefined) flags.relatesTo = opts.relatesTo;
        if (opts.confidence !== undefined) flags.confidence = opts.confidence;
        if (opts.from !== undefined) flags.from = opts.from;
        if (opts.sourceDoc !== undefined) flags.sourceDoc = opts.sourceDoc;
        if (opts.sourceHash !== undefined) flags.sourceHash = opts.sourceHash;
        const code = await runNodeWriteCommand({ kind, slug, flags });
        process.exit(code);
      }
    );

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

  program
    .command('finddocs')
    .description(
      'Deterministically enumerate candidate markdown files for the KB, applying .gitignore, .kbignore, and the built-in static-skip list. Read-only; emits one `+ <relpath>` line per survivor.'
    )
    .option(
      '--from <scope>',
      'narrow discovery to a subdirectory of the repo root (path relative to repo root)'
    )
    .option(
      '--with-hashes',
      'append a tab-separated SHA-256 hex digest to each line so callers can compare against bootstrap-state.json',
      false
    )
    .action(async (opts: { from?: string; withHashes: boolean }) => {
      const flags: Parameters<typeof runFindDocsCommand>[0] = {};
      if (opts.from !== undefined) flags.from = opts.from;
      if (opts.withHashes) flags.withHashes = true;
      const code = await runFindDocsCommand(flags);
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
