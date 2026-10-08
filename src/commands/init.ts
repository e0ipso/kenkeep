import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { getHarness, hasHarness, listHarnessIds } from '../harnesses/registry.js';
import type { HarnessAdapter } from '../harnesses/types.js';
import { ensureAgentsKkBlock } from '../lib/agents-block.js';
import { copyMissingEntries, copyTree } from '../lib/fs-atomic.js';
import { planHarnessRuntimeRepair, repairHarnessRuntime } from '../lib/harness-install-status.js';
import {
  installedVersionRecord,
  mergeHarnessInventory,
  readInstalledVersion,
  writeInstalledVersion,
  type InstalledVersion,
} from '../lib/installed-version.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { MIGRATE_COMMAND_HINT } from '../lib/migrate-guidance.js';
import { findRepoRoot, packageTemplatesDir, repoPaths, type RepoPaths } from '../lib/paths.js';
import { ensureKbignore } from '../lib/kkignore-stub.js';
import { sweepRootLeaves } from './node-sweep.js';
import { NODE_SCHEMA_VERSION } from '../lib/schemas.js';
import { defaultProjectConfigBody } from '../lib/settings.js';
import { packageVersion } from '../lib/version.js';

export interface InitOptions {
  harnesses: string[];
  upgrade?: boolean;
}

const SESSIONS_IGNORE_LINE = '/_sessions/';

const KENKEEP_GITIGNORE_LINES = [
  SESSIONS_IGNORE_LINE,
  '/_logs/',
  '/hooks/',
  '.state/*',
  '!.state/installed-version',
];

/**
 * The supported session-retention opt-in: a team that wants session logs
 * committed (so `derived_from` provenance resolves for every reviewer)
 * replaces the `/_sessions/` rule in `.ai/kenkeep/.gitignore` with its
 * negation. `ensureKbGitignore` recognizes that line and stops re-emitting
 * the ignore rule, so an upgrade never silently reverses the decision.
 */
const SESSIONS_RETENTION_OPT_IN = /^!\/?_sessions\/?$/;

// Unanchored variants kenkeep shipped before the directory patterns were
// anchored to the bundle root. An unanchored `hooks/` also matches the
// `nodes/hooks/` knowledge branch (and likewise for `_sessions/`/`_logs/`), so
// upgrades must drop these legacy lines rather than leave both forms in place.
const LEGACY_UNANCHORED_GITIGNORE_LINES = new Set(['_sessions/', '_logs/', 'hooks/']);

export async function runInit(opts: InitOptions): Promise<void> {
  validateHarnesses(opts.harnesses);

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const templatesDir = packageTemplatesDir();
  if (!existsSync(templatesDir)) {
    throw new Error(
      `Templates directory not found at ${templatesDir}. Run \`npm run build\` if developing locally.`
    );
  }

  const recorded = readInstalledVersion(paths.installedVersionFile);
  if (opts.upgrade) {
    if (!recorded) {
      throw new Error(
        'Not initialized. Run `npx kenkeep init --harnesses <id[,id,...]>` for a first-time install.'
      );
    }
    await runUpgrade(opts, recorded, root, paths, templatesDir);
    return;
  }
  if (recorded) {
    await runRepair(opts, recorded, root, paths, templatesDir);
    return;
  }
  await runFreshInstall(opts, root, paths, templatesDir);
}

async function runFreshInstall(
  opts: InitOptions,
  root: string,
  paths: RepoPaths,
  templatesDir: string
): Promise<void> {
  log.info(`Initializing in ${root}`);

  // 1. Kenkeep skeleton.
  copyTree(join(templatesDir, 'kenkeep'), paths.kkDir);

  // 2. Per-harness files (templates + hook registration). Each adapter in
  //    src/harnesses/<id>/ knows where its own files live.
  for (const id of opts.harnesses) {
    const adapter = getHarness(id);
    await adapter.install({ root, paths, templatesDir, upgrade: false });
  }

  // 3. Prompts under .ai/kenkeep/.config/prompts (for local override).
  const promptsSrc = join(templatesDir, 'prompts');
  if (existsSync(promptsSrc)) {
    copyTree(promptsSrc, paths.promptsDir);
  }

  // 4. Write .ai/kenkeep/.gitignore and update AGENTS.md. The project's
  //    root .gitignore is intentionally untouched.
  ensureKbGitignore(paths.kkGitignoreFile);
  ensureAgentsKkBlock(join(root, 'AGENTS.md'));

  // 4b. Emit `.kkignore` stub. Never overwrites: user-edited scope is sacred.
  const kkignore = ensureKbignore(root);
  if (kkignore.written) {
    log.info(`Wrote default .kkignore at ${kkignore.path}`);
  }

  // 5. Write default settings file unless one is already present. Users edit
  // config.yaml; init never overwrites it.
  ensureProjectConfig(paths);

  // 6. Write installed-version marker.
  writeInstalledVersion(
    paths.installedVersionFile,
    paths.stateDir,
    installedVersionRecord(opts.harnesses)
  );

  log.success('Initialized.');
  printNextSteps(root, opts.harnesses);

  reportSchemaMismatch(paths.nodesDir);
}

/**
 * `init` on an already-initialized repository (the documented teammate flow:
 * commit, clone, run `init`). The hook scripts the committed host configs
 * reference are gitignored, so a fresh clone has none; this restores every
 * recorded harness's missing scripts without rewriting any that exist.
 * Everything else arrives with the clone and is left byte-identical.
 *
 * A requested harness that is not yet recorded is a new installation: it is
 * installed in full and merged into the inventory. Recorded harnesses are
 * never dropped, whatever `--harnesses` names.
 */
async function runRepair(
  opts: InitOptions,
  recorded: InstalledVersion,
  root: string,
  paths: RepoPaths,
  templatesDir: string
): Promise<void> {
  log.info(
    `Already initialized (version ${recorded.version}) in ${root}; restoring missing hook scripts. ` +
      'Use `init --upgrade` to refresh templates while preserving local prompt overrides and `config.yaml`.'
  );
  const known = recorded.harnesses.filter(hasHarness);
  for (const id of recorded.harnesses) {
    if (!hasHarness(id)) log.warn(`Recorded harness '${id}' is unknown to this kenkeep; skipped.`);
  }
  const added = opts.harnesses.filter(id => !recorded.harnesses.includes(id));
  // Every restore target is checked before anything is written, so a refused
  // one (a symlinked hooks directory) leaves the whole repository as it was.
  const repairs = known.map(id => ({
    id,
    plan: planHarnessRuntimeRepair(root, templatesDir, getHarness(id)),
  }));

  for (const id of added) {
    await getHarness(id).install({ root, paths, templatesDir, upgrade: false });
    log.success(`Installed ${id}.`);
  }

  let restoredAnything = false;
  for (const { id, plan } of repairs) {
    const restored = plan ? repairHarnessRuntime(plan) : [];
    if (restored.length === 0) continue;
    restoredAnything = true;
    log.success(`Restored ${plural(restored.length, 'hook script', 'hook scripts')} for ${id}:`);
    for (const name of restored) log.plain(`  ${name}`);
  }

  if (added.length > 0) {
    writeInstalledVersion(paths.installedVersionFile, paths.stateDir, {
      ...recorded,
      harnesses: mergeHarnessInventory(recorded.harnesses, added),
    });
    printNextSteps(root, added);
  } else if (!restoredAnything) {
    log.success('Hook scripts are in place; nothing to restore.');
  }

  reportSchemaMismatch(paths.nodesDir);
}

/**
 * Refreshes templates, skills and hook registrations for every recorded
 * harness plus any newly requested one, then records the merged inventory at
 * the current package version. Refreshing the whole inventory (not only the
 * harnesses named on the command line) keeps the single recorded version
 * truthful for every registration in the repo. Nothing is removed: a harness
 * leaves the inventory only when a human deletes its host registration and
 * edits `.ai/kenkeep/.state/installed-version`.
 */
async function runUpgrade(
  opts: InitOptions,
  recorded: InstalledVersion,
  root: string,
  paths: RepoPaths,
  templatesDir: string
): Promise<void> {
  const current = packageVersion();
  const inventory = mergeHarnessInventory(recorded.harnesses, opts.harnesses);
  const harnesses = inventory.filter(hasHarness);
  for (const id of inventory) {
    if (!hasHarness(id)) log.warn(`Recorded harness '${id}' is unknown to this kenkeep; skipped.`);
  }
  log.info(`Upgrading in ${root} to ${current} (harnesses: ${harnesses.join(', ')})`);

  for (const id of harnesses) {
    const adapter = getHarness(id);
    await adapter.upgrade({ root, paths, templatesDir, upgrade: true });
  }

  // An existing prompt is a local override and stays.
  copyMissingEntries(join(templatesDir, 'prompts'), paths.promptsDir);

  // Ship skeleton scripts (e.g. the shared kk-detect-root helper the kk
  // skills invoke) into existing repos. Upgrade does not re-copy the whole
  // skeleton, so copy any missing script without clobbering user-owned files.
  copyMissingEntries(join(templatesDir, 'kenkeep', 'scripts'), join(paths.kkDir, 'scripts'));
  copyMissingEntries(join(templatesDir, 'kenkeep', 'assets'), join(paths.kkDir, 'assets'));

  ensureKbGitignore(paths.kkGitignoreFile);
  ensureAgentsKkBlock(join(root, 'AGENTS.md'));

  const kkignore = ensureKbignore(root);
  if (kkignore.written) {
    log.info(`Wrote default .kkignore at ${kkignore.path}`);
  }

  ensureProjectConfig(paths);

  writeInstalledVersion(
    paths.installedVersionFile,
    paths.stateDir,
    installedVersionRecord(inventory)
  );

  await sweepRootDuringUpgrade(paths);

  log.success(`Upgraded to ${current}.`);
  log.plain('Run `npx kenkeep doctor` to verify.');

  reportSchemaMismatch(paths.nodesDir);
}

function validateHarnesses(harnesses: string[]): void {
  if (harnesses.length === 0) {
    throw new Error(
      `--harnesses requires at least one entry. Supported: ${listHarnessIds().join(', ')}.`
    );
  }
  for (const h of harnesses) {
    if (!hasHarness(h)) {
      throw new Error(`Unsupported harness '${h}'. Supported: ${listHarnessIds().join(', ')}.`);
    }
  }
}

function ensureProjectConfig(paths: RepoPaths): void {
  if (existsSync(paths.projectConfigFile)) return;
  mkdirSync(paths.kkDir, { recursive: true });
  writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
}

function printNextSteps(root: string, harnesses: string[]): void {
  const artifacts = [...new Set(harnesses.flatMap(id => committedArtifacts(root, getHarness(id))))];
  log.plain('');
  log.plain('Next steps:');
  const list = artifacts.map(a => `\`${a}\``).join(', ');
  log.plain(`  1. Review and commit \`.ai/kenkeep/\`${list ? ` and ${list}` : ''}.`);
  log.plain('  2. Run `npx kenkeep doctor` to verify the setup.');
}

/**
 * Repo-relative locations an adapter's install wrote and the team should
 * commit: its root directory when it exists, plus any registration, skills or
 * plugin location that lives outside that directory (Codex's
 * `.agents/skills/`). Derived from the adapter's declared paths so the
 * message cannot name a directory the adapter never creates.
 */
function committedArtifacts(root: string, adapter: HarnessAdapter): string[] {
  const locs = adapter.paths(root);
  const rel = (p: string): string => relative(root, p).split(sep).join('/');
  const out: string[] = [];
  if (existsSync(locs.dir)) out.push(`${rel(locs.dir)}/`);
  for (const p of [locs.settingsFile, locs.skillsDir, locs.pluginsDir]) {
    if (!p || !existsSync(p) || p.startsWith(`${locs.dir}${sep}`)) continue;
    out.push(statSync(p).isDirectory() ? `${rel(p)}/` : rel(p));
  }
  return out;
}

/**
 * Surfaces an out-of-date node store at init/upgrade time. Neither `init` nor
 * `init --upgrade` migrates `nodes/`, so a knowledge base written by an older
 * kenkeep stays stale and every command that reads it would fail. We detect the
 * on-disk schema and point the user at the `kk-migrate` skill that fixes it,
 * matching the error the node reader raises. Loud but non-fatal: init did its
 * own job; migration is a deliberate, in-session follow-up the user runs next.
 *
 * `init --upgrade` does write to `nodes/` in one place, `sweepRootDuringUpgrade`
 * above, which is gated on this same schema check and never runs against a tree
 * this detector would flag.
 */
function reportSchemaMismatch(nodesDir: string): void {
  const onDisk = detectSchemaVersion(nodesDir);
  if (onDisk === null || onDisk >= NODE_SCHEMA_VERSION) return;
  log.error(
    `Knowledge base on disk is at schema_version ${onDisk}, but this kenkeep reads ` +
      `schema_version ${NODE_SCHEMA_VERSION}. nodes/ was left untouched and commands that ` +
      `read it will fail until you migrate it: use ${MIGRATE_COMMAND_HINT}.`
  );
}

/**
 * Files the leaves sitting at the `nodes/` root as part of an upgrade, running
 * the same sweep as `node sweep` with the same rules: a leaf its own edges or
 * tags place is filed there; an unplaceable leaf is deleted when nothing
 * references it and git can restore it, and kept at the root otherwise.
 * Upgrade is the moment a repository picks up write-time placement, so it is
 * also the moment its existing backlog of loose leaves gets cleared.
 *
 * This is the one part of `init` that writes to `nodes/`. It leaves an
 * uncommitted working-tree change like every other node mutation here: accept
 * it with `git commit`, reject it with the printed `git restore` per deletion.
 * Nothing is staged and nothing is committed.
 *
 * Skipped when `nodes/` is absent or its on-disk schema predates the one this
 * kenkeep reads, because the node reader refuses that tree; `reportSchemaMismatch`
 * sends the user to `kk-migrate` instead. Non-fatal either way: a sweep failure
 * is reported and the upgrade still succeeds, because the upgrade's own work is
 * already done.
 */
async function sweepRootDuringUpgrade(paths: ReturnType<typeof repoPaths>): Promise<void> {
  if (!existsSync(paths.nodesDir)) return;
  const onDisk = detectSchemaVersion(paths.nodesDir);
  if (onDisk === null || onDisk < NODE_SCHEMA_VERSION) return;

  let summary;
  try {
    summary = await sweepRootLeaves(paths);
  } catch (err) {
    log.warn(`Could not sweep the nodes/ root: ${(err as Error).message}`);
    return;
  }

  const { relocated, deleted, kept } = summary;
  if (relocated.length + deleted.length + kept.length === 0) return;

  if (relocated.length > 0) {
    log.success(`Filed ${plural(relocated.length, 'loose leaf', 'loose leaves')}:`);
    for (const move of relocated) {
      log.plain(`  ${move.from} -> ${move.to}`);
    }
  }
  if (deleted.length > 0) {
    log.warn(`Deleted ${plural(deleted.length, 'leaf', 'leaves')} matching no folder:`);
    for (const gone of deleted) {
      log.plain(`  ${gone.path} (${gone.reason}); restore: ${gone.restore}`);
    }
  }
  if (kept.length > 0) {
    log.warn(
      `Kept ${plural(kept.length, 'leaf', 'leaves')} matching no folder at the nodes/ root:`
    );
    for (const stay of kept) {
      log.plain(`  ${stay.path} (${stay.reason})`);
    }
  }
  if (summary.failed === true) {
    log.warn('The index rebuild after the sweep failed; run `npx kenkeep index rebuild`.');
  }
  log.plain('Review with `git diff`.');
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Ensures `.ai/kenkeep/.gitignore` carries every canonical generated-state
 * entry, anchored to the bundle root. User-owned content is preserved; the
 * canonical lines are re-emitted in order and the legacy unanchored variants
 * (the `hooks/` footgun that also ignored `nodes/hooks/`) are dropped, so an
 * upgrade converts an existing gitignore rather than leaving both forms.
 *
 * One canonical line is conditional: when the file carries the
 * session-retention opt-in (`!/_sessions/`, see `SESSIONS_RETENTION_OPT_IN`)
 * the `/_sessions/` rule is not re-added, so the team's decision to commit
 * session logs survives every upgrade.
 */
function ensureKbGitignore(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (existing.trim().length === 0) {
    writeFileSync(file, `${KENKEEP_GITIGNORE_LINES.join('\n')}\n`);
    return;
  }
  const canonical = new Set(KENKEEP_GITIGNORE_LINES);
  // Keep only user-owned lines: canonical lines are re-emitted in order below,
  // and the legacy unanchored variants are pruned so the footgun is removed.
  const userLines = existing
    .replace(/\n+$/, '')
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();
      return !canonical.has(trimmed) && !LEGACY_UNANCHORED_GITIGNORE_LINES.has(trimmed);
    });
  const retainsSessions = userLines.some(line => SESSIONS_RETENTION_OPT_IN.test(line.trim()));
  const canonicalLines = retainsSessions
    ? KENKEEP_GITIGNORE_LINES.filter(line => line !== SESSIONS_IGNORE_LINE)
    : KENKEEP_GITIGNORE_LINES;
  const next = `${[...canonicalLines, ...userLines].join('\n')}\n`;
  if (next === existing) return;
  writeFileSync(file, next);
}
