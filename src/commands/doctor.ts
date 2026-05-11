import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { log } from '../lib/log.js';
import { computeNodesHash, readAllNodes } from '../lib/nodes.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';
import { IndexFrontmatterSchema, SettingsSchema } from '../lib/schemas.js';
import { packageVersion } from '../lib/version.js';

const exec = promisify(execFile);

export interface DoctorOptions {
  verbose?: boolean;
}

type CheckResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string; level: 'error' | 'warn' };

interface NamedCheck {
  name: string;
  result: CheckResult;
}

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  // Auto-migrate legacy `.ai/.kb-builder/` state to the new layout. Surface
  // a notice so the user knows what happened.
  const migration = ensureStateLayout(paths);
  if (migration.migrated) {
    log.success(
      `state layout migrated: .ai/.kb-builder/ → .ai/knowledge-base/.state/ (${migration.movedEntries.length} entr${migration.movedEntries.length === 1 ? 'y' : 'ies'})`,
    );
  }

  const checks: NamedCheck[] = [];
  checks.push({ name: 'Node.js >= 22', result: checkNodeVersion() });
  checks.push({ name: 'claude CLI on PATH', result: await checkClaude() });
  checks.push({ name: 'gitleaks on PATH', result: await checkGitleaks() });
  checks.push({
    name: '.ai/knowledge-base/.state/installed-version',
    result: checkInstalledVersion(paths.installedVersionFile),
  });
  checks.push({
    name: 'no legacy .ai/.kb-builder/ directory',
    result: checkLegacyStateDir(paths.legacyStateDir),
  });
  checks.push({
    name: 'installed-version is current',
    result: checkInstalledVersionCurrent(paths.installedVersionFile),
  });
  checks.push({
    name: 'pre-commit config installed',
    result: checkPreCommit(paths.preCommitConfigFile),
  });
  checks.push({
    name: '.gitignore lists ai-knowledge-base paths',
    result: checkGitignore(paths.gitignoreFile),
  });

  checks.push({
    name: 'Claude hooks registered',
    result: checkClaudeHooks(paths.claudeSettingsFile, paths.claudeHooksDir),
  });
  checks.push({
    name: 'Claude skills installed',
    result: checkClaudeSkills(paths.claudeSkillsDir),
  });
  checks.push({
    name: 'no legacy .claude/commands/kb-*.md',
    result: checkLegacyKbCommands(paths.claudeCommandsDir),
  });
  checks.push({
    name: 'shipped prompts present',
    result: checkPrompts(paths.stateDir),
  });
  checks.push({
    name: 'settings file is valid',
    result: checkSettings(paths.projectConfigFile),
  });
  checks.push({
    name: 'INDEX.md is fresh',
    result: checkIndexFreshness(join(paths.kbDir, 'INDEX.md'), paths.nodesDir),
  });

  const dangling = collectDanglingDerivedFrom(root, paths.nodesDir, paths.sessionsDir);
  checks.push({
    name: 'derived_from references resolve',
    result:
      dangling.length === 0
        ? { ok: true, detail: 'no dangling references' }
        : {
            ok: false,
            level: 'warn',
            detail: `${dangling.length} dangling reference(s)${
              opts.verbose ? '' : ' — re-run with --verbose to list them'
            }`,
          },
  });

  let failures = 0;
  let warnings = 0;
  for (const c of checks) {
    if (c.result.ok) {
      log.success(`${c.name}: ${c.result.detail}`);
    } else if (c.result.level === 'warn') {
      log.warn(`${c.name}: ${c.result.detail}`);
      warnings += 1;
    } else {
      log.error(`${c.name}: ${c.result.detail}`);
      failures += 1;
    }
  }

  if (opts.verbose && dangling.length > 0) {
    log.plain('');
    log.plain('Dangling derived_from references:');
    for (const d of dangling) {
      log.plain(`  - ${d.nodeId}: ${d.reference}`);
    }
  }

  log.plain('');
  if (failures === 0 && warnings === 0) {
    log.success('All checks passed.');
    return 0;
  }
  if (failures === 0) {
    log.warn(`${warnings} warning(s).`);
    return 0;
  }
  log.error(`${failures} error(s), ${warnings} warning(s).`);
  return 1;
}

interface DanglingRef {
  nodeId: string;
  reference: string;
}

/**
 * Collects every `derived_from` entry whose target does not exist on disk.
 * A reference resolves if any of these match:
 *   - It is a bare filename and exists under `_sessions/`.
 *   - It is a repo-relative path and exists when resolved against `root`.
 *   - It is an absolute path and exists as-is.
 */
export function collectDanglingDerivedFrom(
  root: string,
  nodesDir: string,
  sessionsDir: string,
): DanglingRef[] {
  if (!existsSync(nodesDir)) return [];
  const out: DanglingRef[] = [];
  for (const node of readAllNodes(nodesDir)) {
    for (const ref of node.frontmatter.derived_from) {
      if (resolvesOnDisk(ref, root, sessionsDir)) continue;
      out.push({ nodeId: node.frontmatter.id, reference: ref });
    }
  }
  return out;
}

function resolvesOnDisk(ref: string, root: string, sessionsDir: string): boolean {
  if (ref.length === 0) return false;
  if (isAbsolute(ref) && existsSync(ref)) return true;
  if (existsSync(join(root, ref))) return true;
  if (!ref.includes('/') && existsSync(join(sessionsDir, ref))) return true;
  return false;
}

function checkNodeVersion(): CheckResult {
  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isFinite(major) && major >= 22) {
    return { ok: true, detail: `Node ${process.versions.node}` };
  }
  return { ok: false, level: 'error', detail: `Node ${process.versions.node} (need >= 22)` };
}

async function checkClaude(): Promise<CheckResult> {
  try {
    const { stdout } = await exec('claude', ['--version'], { timeout: 5000 });
    return { ok: true, detail: stdout.trim() || 'present' };
  } catch (err) {
    return {
      ok: false,
      level: 'error',
      detail: `not runnable (${(err as Error).message.split('\n')[0]})`,
    };
  }
}

async function checkGitleaks(): Promise<CheckResult> {
  try {
    const { stdout } = await exec('gitleaks', ['version'], { timeout: 5000 });
    return { ok: true, detail: stdout.trim() || 'present' };
  } catch {
    return {
      ok: false,
      level: 'warn',
      detail:
        'not found on PATH. v1 vendors gitleaks via optionalDependencies; install pre-commit and run `pre-commit install` to wire it up, or install gitleaks manually.',
    };
  }
}

function checkInstalledVersion(file: string): CheckResult {
  if (!existsSync(file)) {
    return {
      ok: false,
      level: 'error',
      detail: 'missing. Run `ai-knowledge-base init --assistants claude` from the repo root.',
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
    return { ok: true, detail: parsed.version ?? 'present (no version field)' };
  } catch (err) {
    return { ok: false, level: 'error', detail: `unreadable: ${(err as Error).message}` };
  }
}

function checkInstalledVersionCurrent(file: string): CheckResult {
  if (!existsSync(file)) {
    return {
      ok: false,
      level: 'warn',
      detail: 'no installed-version stamp; skipping currency check.',
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
    const installed = typeof parsed.version === 'string' ? parsed.version : null;
    const current = packageVersion();
    if (installed === null) {
      return { ok: false, level: 'warn', detail: 'installed-version has no `version` field.' };
    }
    if (installed === current) {
      return { ok: true, detail: `${current}` };
    }
    return {
      ok: false,
      level: 'warn',
      detail: `installed ${installed} ≠ package ${current}. Run \`ai-knowledge-base init --upgrade\` to refresh templates.`,
    };
  } catch (err) {
    return { ok: false, level: 'warn', detail: `unreadable: ${(err as Error).message}` };
  }
}

function checkPreCommit(file: string): CheckResult {
  if (!existsSync(file)) {
    return {
      ok: false,
      level: 'warn',
      detail: 'no .pre-commit-config.yaml at repo root. Re-run `init` or add gitleaks manually.',
    };
  }
  const body = readFileSync(file, 'utf8');
  if (body.includes('gitleaks')) {
    return { ok: true, detail: 'gitleaks entry present' };
  }
  return { ok: false, level: 'warn', detail: 'present but no gitleaks entry found' };
}

const EXPECTED_HOOK_SCRIPTS: Record<string, string[]> = {
  Stop: ['.claude/hooks/kb-capture.mjs'],
  SessionEnd: ['.claude/hooks/kb-capture.mjs'],
  PreCompact: ['.claude/hooks/kb-capture.mjs'],
  SessionStart: ['.claude/hooks/kb-stage2-drain.mjs', '.claude/hooks/kb-session-start.mjs'],
};

function checkClaudeHooks(settingsFile: string, hooksDir: string): CheckResult {
  if (!existsSync(settingsFile)) {
    return {
      ok: false,
      level: 'error',
      detail: 'no .claude/settings.json. Run `ai-knowledge-base init --assistants claude --force`.',
    };
  }
  let settings: {
    hooks?: Record<string, Array<{ hooks: Array<{ command?: string }> }>>;
  };
  try {
    settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as typeof settings;
  } catch (err) {
    return { ok: false, level: 'error', detail: `unparseable: ${(err as Error).message}` };
  }
  const hooks = settings.hooks ?? {};
  const missing: string[] = [];
  for (const [event, scripts] of Object.entries(EXPECTED_HOOK_SCRIPTS)) {
    const commands = (hooks[event] ?? []).flatMap((e) =>
      (e.hooks ?? []).map((h) => h.command ?? ''),
    );
    for (const script of scripts) {
      if (!commands.some((c) => c.includes(script))) {
        missing.push(`${event} → ${script}`);
      }
    }
  }
  const missingFiles: string[] = [];
  for (const script of new Set(Object.values(EXPECTED_HOOK_SCRIPTS).flat())) {
    const file = join(hooksDir, script.split('/').pop()!);
    if (!existsSync(file)) missingFiles.push(script);
  }
  if (missing.length === 0 && missingFiles.length === 0) {
    return { ok: true, detail: 'all expected hook entries and scripts present' };
  }
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing registrations: ${missing.join(', ')}`);
  if (missingFiles.length > 0) parts.push(`missing scripts: ${missingFiles.join(', ')}`);
  return {
    ok: false,
    level: 'error',
    detail: parts.join('; ') + '. Re-run `ai-knowledge-base init --assistants claude --force`.',
  };
}

const EXPECTED_SKILLS = ['kb-add', 'kb-bootstrap', 'kb-curate'];

function checkClaudeSkills(skillsDir: string): CheckResult {
  if (!existsSync(skillsDir)) {
    return {
      ok: false,
      level: 'error',
      detail: `no .claude/skills/ directory. Re-run \`ai-knowledge-base init --assistants claude --force\`.`,
    };
  }
  const missing = EXPECTED_SKILLS.filter((name) => !existsSync(join(skillsDir, name, 'SKILL.md')));
  if (missing.length === 0) {
    return { ok: true, detail: EXPECTED_SKILLS.join(', ') };
  }
  return {
    ok: false,
    level: 'error',
    detail: `missing SKILL.md for: ${missing.join(', ')}. Re-run \`ai-knowledge-base init --upgrade\`.`,
  };
}

const LEGACY_KB_COMMAND_FILES = ['kb-add.md', 'kb-bootstrap.md', 'kb-curate.md'];

function checkLegacyKbCommands(commandsDir: string): CheckResult {
  if (!existsSync(commandsDir)) {
    return { ok: true, detail: 'no legacy commands directory' };
  }
  const lingering = LEGACY_KB_COMMAND_FILES.filter((n) => existsSync(join(commandsDir, n)));
  if (lingering.length === 0) {
    return { ok: true, detail: 'none present' };
  }
  return {
    ok: false,
    level: 'warn',
    detail: `legacy slash-command file(s) found (the kb-* commands are now Skills under .claude/skills/): ${lingering
      .map((n) => `.claude/commands/${n}`)
      .join(', ')}. Run \`ai-knowledge-base init --upgrade\` to remove them.`,
  };
}

function checkLegacyStateDir(legacyDir: string): CheckResult {
  if (!existsSync(legacyDir)) {
    return { ok: true, detail: 'legacy directory not present' };
  }
  return {
    ok: false,
    level: 'warn',
    detail:
      `legacy .ai/.kb-builder/ still on disk. The auto-migration moves state into .ai/knowledge-base/.state/; ` +
      'a leftover here usually means a manual mv left an empty husk. Safe to `rm -rf .ai/.kb-builder/`.',
  };
}

function checkPrompts(stateDir: string): CheckResult {
  const expected = ['stage-2-extract.md', 'curator.md', 'bootstrap-incremental.md'];
  const missing = expected.filter((p) => !existsSync(join(stateDir, 'prompts', p)));
  if (missing.length === 0) {
    return { ok: true, detail: 'stage-2, curator, bootstrap-incremental' };
  }
  return {
    ok: false,
    level: 'warn',
    detail: `missing local override(s): ${missing.join(', ')}. The bundled package fallback is still used; re-run \`init --force\` to restore.`,
  };
}

function checkIndexFreshness(indexFile: string, nodesDir: string): CheckResult {
  if (!existsSync(indexFile)) {
    return {
      ok: false,
      level: 'warn',
      detail: 'INDEX.md missing — run `ai-knowledge-base index rebuild`.',
    };
  }
  try {
    const parsed = matter(readFileSync(indexFile, 'utf8'));
    const fm = IndexFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) {
      return { ok: false, level: 'warn', detail: 'INDEX.md frontmatter is invalid; rebuild it.' };
    }
    const recorded = fm.data.nodes_hash.startsWith('sha256:')
      ? fm.data.nodes_hash.slice(7)
      : fm.data.nodes_hash;
    const live = computeNodesHash(nodesDir);
    if (recorded === live) return { ok: true, detail: `fresh (${fm.data.node_count} node(s))` };
    return {
      ok: false,
      level: 'warn',
      detail: 'stale (nodes_hash drift) — run `ai-knowledge-base index rebuild`.',
    };
  } catch (err) {
    return { ok: false, level: 'warn', detail: `unreadable: ${(err as Error).message}` };
  }
}

function checkSettings(file: string): CheckResult {
  if (!existsSync(file)) {
    return {
      ok: false,
      level: 'warn',
      detail: `no .ai/knowledge-base/.config.json — package defaults are in effect. Run \`ai-knowledge-base init --upgrade\` to create one.`,
    };
  }
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    return { ok: false, level: 'error', detail: `unreadable: ${(err as Error).message}` };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return { ok: false, level: 'error', detail: `invalid JSON: ${(err as Error).message}` };
  }
  const parsed = SettingsSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      level: 'error',
      detail: `schema validation failed: ${parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`,
    };
  }
  const keys = Object.keys(parsed.data).filter((k) => k !== 'schema_version').length;
  return { ok: true, detail: `valid (${keys} override(s))` };
}

function checkGitignore(file: string): CheckResult {
  if (!existsSync(file)) {
    return { ok: false, level: 'warn', detail: 'no .gitignore at repo root' };
  }
  const body = readFileSync(file, 'utf8');
  if (body.includes('.ai/knowledge-base/_sessions') && body.includes('.ai/knowledge-base/_logs')) {
    return { ok: true, detail: 'ai-knowledge-base block present' };
  }
  return {
    ok: false,
    level: 'warn',
    detail: 'missing entries for `.ai/knowledge-base/_sessions/` and/or `_logs/`',
  };
}
