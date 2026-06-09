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
import { runSessionLogUpdateProposalsCommand } from './commands/session-log-update-proposals.js';
import { runMigrateStatus } from './commands/migrate.js';
import { runNodeAddLauncher } from './commands/node-add.js';
import { runNodeWriteCommand } from './commands/node-write.js';
import { runPlaceApply, runPlaceInventory } from './commands/place.js';
import { runRebalanceMove, runRebalanceTrigger } from './commands/rebalance.js';
import { runStatus } from './commands/status.js';
import { listHarnessIds } from './harnesses/registry.js';
import { log } from './lib/log.js';
import { packageVersion } from './lib/version.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('kenkeep')
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
    .description('Show pending session logs and kenkeep stats.')
    .action(async () => {
      await runStatus();
    });

  program
    .command('doctor')
    .description('Verify hook installation and schema validity.')
    .option('-v, --verbose', 'show extra diagnostics', false)
    .action(async (opts: { verbose: boolean }) => {
      const code = await runDoctor({ ...opts, harness: program.opts().harness });
      process.exit(code);
    });

  program
    .command('lint')
    .description(
      'Run mechanical kenkeep content health checks (dangling edges, slug/id mismatch, tag duplicates, orphans).'
    )
    .option('-v, --verbose', 'list every error and finding individually', false)
    .action(async (opts: { verbose: boolean }) => {
      const code = await runLintCommand({ verbose: opts.verbose });
      process.exit(code);
    });

  program
    .command('curate')
    .description(
      'Launch the kk-curate skill in the active harness (execs `<harness> -p "/kk-curate"`).'
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
      'Launch the kk-bootstrap skill in the active harness (execs `<harness> -p "/kk-bootstrap …"`). Scope is controlled by .kkignore plus an optional --from <scope>.'
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
      '[deprecated] Alias for `bootstrap`; will be removed in the next release. Use `kenkeep bootstrap` instead.'
    )
    .option(
      '--from <scope>',
      'narrow discovery to a subdirectory of the repo root (path relative to repo root)'
    )
    .action((opts: { from?: string }) => {
      process.stderr.write(
        "[deprecated] use 'kenkeep bootstrap' instead of 'bootstrap-incremental'\n"
      );
      const launchOpts: Parameters<typeof runBootstrapLauncher>[0] = {};
      if (opts.from !== undefined) launchOpts.from = opts.from;
      const harnessFlag = getHarnessFlag();
      if (harnessFlag !== undefined) launchOpts.harness = harnessFlag;
      runBootstrapLauncher(launchOpts);
    });

  const migrateGroup = program
    .command('migrate')
    .description(
      "Reports pending knowledge-base migrations. Never executes them: migrations run in-host via the kk-migrate skill, which dispatches on this command's output."
    );
  migrateGroup
    .command('status')
    .description(
      'Deterministic, LLM-free migration report: detects the on-disk schema_version and, when migrations are pending, prints the ordered step chain as a JSON document {"current","target","steps":[{"id","from","to","primitives"}]} for the kk-migrate skill to dispatch on, or reports "nothing to do" when already current.'
    )
    .allowExcessArguments(true)
    .action(async () => {
      const code = await runMigrateStatus();
      process.exit(code);
    });

  const placeGroup = program
    .command('place')
    .description(
      'Deterministic, LLM-free v1->v2 migration placement primitives (driven by the kk-migrate skill).'
    );
  placeGroup
    .command('inventory')
    .description(
      'Deterministic, LLM-free migration check: detects the on-disk schema_version and, when a v1->v2 migration is due, prints the flat leaves as a JSON document {"leaves":[{"id","title","kind","tags","summary","relates_to","sourcePath"}]} for the kk-migrate skill to cluster, or reports "nothing to do" when already current.'
    )
    .allowExcessArguments(true)
    .action(async () => {
      const code = await runPlaceInventory();
      process.exit(code);
    });
  placeGroup
    .command('apply')
    .description(
      'Deterministic placement primitive: applies a caller-supplied placement-and-folders plan {"placements":[{"id","targetFolder"}],"folders":[{"folder","summary"}]} as id-stable, byte-stable relocations and stamps each authored folder summary. Validates every id and folder before any write (a bad plan aborts with zero changes). Reads the plan JSON from --input or stdin. Writes files only; never stages or commits. Prints a placement summary JSON.'
    )
    .option('--input <path>', 'path to the placement-and-folders JSON; reads stdin when omitted')
    .allowExcessArguments(true)
    .action(async (opts: { input?: string }) => {
      const flags: Parameters<typeof runPlaceApply>[0] = {};
      if (opts.input !== undefined) flags.input = opts.input;
      const code = await runPlaceApply(flags);
      process.exit(code);
    });

  const rebalanceGroup = program
    .command('rebalance')
    .description('Deterministic, LLM-free tree rebalance primitives (the final phase of curate).');
  rebalanceGroup
    .command('trigger')
    .description(
      'Deterministic, LLM-free rebalance check: reads Plan 1 per-folder metrics and prints a stable JSON decision {"actions":[{"branch","operation"}]} (split-folder/split-leaf/merge/create-branch), or {"actions":[]} when nothing trips past the hysteresis margin so the LLM phase is skipped.'
    )
    .allowExcessArguments(true)
    .action(async () => {
      const code = await runRebalanceTrigger();
      process.exit(code);
    });
  rebalanceGroup
    .command('move')
    .description(
      'Deterministic move primitive: applies a caller-supplied operation plan (split-folder/split-leaf/merge/create-branch) as content-byte-stable, id-stable git renames (split-leaf mints new ids + a redirect), then rebuilds affected index nodes and nodes_hash. Reads the plan JSON from --input or stdin. Writes files only; never stages or commits. Prints a structural summary JSON.'
    )
    .option('--input <path>', 'path to the operation-plan JSON; reads stdin when omitted')
    .allowExcessArguments(true)
    .action(async (opts: { input?: string }) => {
      const flags: Parameters<typeof runRebalanceMove>[0] = {};
      if (opts.input !== undefined) flags.input = opts.input;
      const code = await runRebalanceMove(flags);
      process.exit(code);
    });

  const nodeGroup = program.command('node').description('Manage kenkeep nodes.');
  nodeGroup
    .command('add')
    .description(
      'Launch the kk-add skill in the active harness (execs `<harness> -p "/kk-add"`). The skill collects kind/title/summary/body/tags interactively and persists via the `node write` primitive.'
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
      'Headless primitive: atomically write a single node to nodes/<folder>/<id>.md (or nodes/<id>.md at the root when --folder is omitted) with Zod-validated frontmatter and slug-collision resolution. The folder is presentation only; the id is folder-independent. Body read from stdin (default) or --from <path>. Prints the resolved id to stdout. When both --source-doc and --source-hash are passed, also updates bootstrap-state.json per-file hash map.'
    )
    .argument('<kind>', 'node kind: practice or map')
    .argument('<slug>', 'proposed id base (kind prefix added automatically when missing)')
    .option('--title <title>', 'short title (≤ 80 chars)')
    .option('--summary <summary>', 'one-line summary (≤ 140 chars)')
    .option('--tags <list>', 'comma-separated tags')
    .option('--relates-to <list>', 'comma-separated node ids (loose cross edges)')
    .option('--depends-on <list>', 'comma-separated node ids this node depends on')
    .option('--confidence <level>', 'low, medium, or high (default: high)')
    .option('--from <path>', 'read body from <path> instead of stdin')
    .option(
      '--folder <relpath>',
      'existing home folder under nodes/ (POSIX-style); omitted/empty lands the leaf at the nodes/ root'
    )
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
          dependsOn?: string;
          confidence?: string;
          from?: string;
          folder?: string;
          sourceDoc?: string;
          sourceHash?: string;
        }
      ) => {
        const flags: Parameters<typeof runNodeWriteCommand>[0]['flags'] = {};
        if (opts.title !== undefined) flags.title = opts.title;
        if (opts.summary !== undefined) flags.summary = opts.summary;
        if (opts.tags !== undefined) flags.tags = opts.tags;
        if (opts.relatesTo !== undefined) flags.relatesTo = opts.relatesTo;
        if (opts.dependsOn !== undefined) flags.dependsOn = opts.dependsOn;
        if (opts.confidence !== undefined) flags.confidence = opts.confidence;
        if (opts.from !== undefined) flags.from = opts.from;
        if (opts.folder !== undefined) flags.folder = opts.folder;
        if (opts.sourceDoc !== undefined) flags.sourceDoc = opts.sourceDoc;
        if (opts.sourceHash !== undefined) flags.sourceHash = opts.sourceHash;
        const code = await runNodeWriteCommand({ kind, slug, flags });
        process.exit(code);
      }
    );

  const indexGroup = program.command('index').description('Manage ENTRY.md and GRAPH.md.');
  indexGroup
    .command('rebuild')
    .description('Regenerate ENTRY.md and GRAPH.md from the current nodes/ tree (deterministic).')
    .option(
      '--stage',
      'after writing, `git add` ENTRY.md and GRAPH.md (no-op outside a git repo)',
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
      'Delete JSONL log files under .ai/kenkeep/_logs/ older than settings.logsRetentionDays (default 30 days).'
    )
    .action(async () => {
      const code = await runLogsPrune();
      process.exit(code);
    });

  const sessionLogGroup = program.command('session-log').description('Manage session log files.');
  sessionLogGroup
    .command('update-proposals')
    .description(
      'Headless primitive: read proposal JSON from stdin, validate against ProposalOutputSchema, and write results into the session log frontmatter at <path>. Pure Node — no LLM.'
    )
    .argument('<path>', 'path to the session log file')
    .requiredOption('--status <status>', 'proposal status: done or failed')
    .option('--error <message>', 'error message (used with --status failed)')
    .action(async (path: string, opts: { status: string; error?: string }) => {
      const code = await runSessionLogUpdateProposalsCommand({
        path,
        status: opts.status,
        error: opts.error,
      });
      process.exit(code);
    });

  program
    .command('finddocs')
    .description(
      'Deterministically enumerate candidate markdown files for the kk, applying .gitignore, .kkignore, and the built-in static-skip list. Read-only; emits one `+ <relpath>` line per survivor.'
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
