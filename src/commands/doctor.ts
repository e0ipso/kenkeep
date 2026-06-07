import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { getHarness, hasHarness } from '../harnesses/registry.js';
import { log } from '../lib/log.js';
import {
  computeNodesHash,
  formatIssue,
  InvalidNodeFrontmatterError,
  readAllNodes,
} from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { IndexFrontmatterSchema, SettingsSchema } from '../lib/schemas.js';
import { packageVersion } from '../lib/version.js';

const EXPECTED_PROMPTS = ['proposal-extract.md'];

export interface DoctorOptions {
  verbose?: boolean;
  harness?: string;
}

type CheckResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string; level: 'error' | 'warn' };

interface NamedCheck {
  name: string;
  result: CheckResult;
}

interface DanglingRef {
  nodeId: string;
  reference: string;
}

interface FrontmatterCheck {
  result: CheckResult;
  canEnumerate: boolean;
  error?: InvalidNodeFrontmatterError;
}

const ok = (detail: string): CheckResult => ({ ok: true, detail });
const err = (detail: string): CheckResult => ({ ok: false, level: 'error', detail });
const warn = (detail: string): CheckResult => ({ ok: false, level: 'warn', detail });

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const frontmatterCheck = checkNodeFrontmatter(paths.nodesDir);
  let dangling: DanglingRef[] = [];
  const danglingResult: CheckResult = !frontmatterCheck.canEnumerate
    ? warn('skipped; nodes failed frontmatter validation, fix those first.')
    : (dangling = collectDanglingDerivedFrom(root, paths.nodesDir, paths.sessionsDir)).length === 0
      ? ok('no dangling references')
      : warn(
          `${dangling.length} dangling reference(s)${
            opts.verbose ? '' : '; re-run with --verbose to list them'
          }`
        );

  const harnessChecks: NamedCheck[] = [];
  const installed = installedHarnessIds(paths.installedVersionFile);
  const scoped = opts.harness ? [opts.harness] : installed;
  for (const id of scoped) {
    if (!hasHarness(id)) continue;
    if (opts.harness && !installed.includes(id)) continue;
    const adapter = getHarness(id);
    const checks = await adapter.doctorChecks(paths);
    for (const c of checks) harnessChecks.push({ name: c.name, result: c.result });
  }

  const checks: NamedCheck[] = [
    { name: 'Node.js >= 22', result: checkNodeVersion() },
    {
      name: '.ai/kenkeep/.state/installed-version',
      result: checkInstalled(paths.installedVersionFile),
    },
    {
      name: '.gitignore lists kenkeep paths',
      result: checkGitignore(paths.kkGitignoreFile),
    },
    { name: '.kkignore present and non-empty', result: checkKbignore(join(root, '.kkignore')) },
    ...harnessChecks,
    { name: 'shipped prompts present', result: checkPrompts(paths.promptsDir) },
    { name: 'settings file is valid', result: checkSettings(paths.projectConfigFile) },
    {
      name: 'ENTRY.md is fresh',
      result: checkIndexFreshness(join(paths.kkDir, 'ENTRY.md'), paths.nodesDir),
    },
    { name: 'node frontmatter valid', result: frontmatterCheck.result },
    { name: 'derived_from references resolve', result: danglingResult },
  ];

  let failures = 0;
  let warnings = 0;
  for (const c of checks) {
    if (c.result.ok) log.success(`${c.name}: ${c.result.detail}`);
    else if (c.result.level === 'warn') {
      log.warn(`${c.name}: ${c.result.detail}`);
      warnings += 1;
    } else {
      log.error(`${c.name}: ${c.result.detail}`);
      failures += 1;
    }
  }

  if (opts.verbose && frontmatterCheck.error) {
    log.plain('');
    log.plain('Invalid node frontmatter:');
    for (const failure of frontmatterCheck.error.failures) {
      log.plain(`  ${failure.file}: ${failure.reason}`);
      for (const issue of failure.issues) log.plain(`    - ${formatIssue(issue)}`);
    }
  }
  if (opts.verbose && dangling.length > 0) {
    log.plain('');
    log.plain('Dangling derived_from references:');
    for (const d of dangling) log.plain(`  - ${d.nodeId}: ${d.reference}`);
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
  sessionsDir: string
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

function checkNodeFrontmatter(nodesDir: string): FrontmatterCheck {
  if (!existsSync(nodesDir)) return { result: ok('no nodes/ directory yet'), canEnumerate: true };
  try {
    const nodes = readAllNodes(nodesDir);
    return {
      result: ok(`${nodes.length} node file(s), all parse cleanly`),
      canEnumerate: true,
    };
  } catch (e) {
    if (e instanceof InvalidNodeFrontmatterError) {
      return {
        result: err(
          `${e.failures.length} file(s) failed validation; re-run with --verbose to list them.`
        ),
        canEnumerate: false,
        error: e,
      };
    }
    throw e;
  }
}

function checkNodeVersion(): CheckResult {
  const major = Number(process.versions.node.split('.')[0]);
  return Number.isFinite(major) && major >= 22
    ? ok(`Node ${process.versions.node}`)
    : err(`Node ${process.versions.node} (need >= 22)`);
}

/**
 * Reads the harness ids recorded in the `installed-version` marker so
 * doctor only audits adapters the user actually installed. A missing or
 * unreadable file yields an empty list; that case is surfaced by the
 * separate `installed-version` check.
 */
function installedHarnessIds(file: string): string[] {
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { harnesses?: unknown };
    return Array.isArray(parsed.harnesses)
      ? parsed.harnesses.filter((h): h is string => typeof h === 'string')
      : [];
  } catch {
    return [];
  }
}

function checkInstalled(file: string): CheckResult {
  if (!existsSync(file)) {
    return err(
      'missing. Run `npx kenkeep init --harnesses claude` from the repo root.'
    );
  }
  let parsed: { version?: string };
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
  } catch (e) {
    return err(`unreadable: ${(e as Error).message}`);
  }
  const installed = typeof parsed.version === 'string' ? parsed.version : null;
  const current = packageVersion();
  if (installed === null) return warn('installed-version has no `version` field.');
  if (installed === current) return ok(current);
  return warn(
    `installed ${installed}, package ${current}. Run \`npx kenkeep init --upgrade\` to refresh templates.`
  );
}

function checkPrompts(promptsDir: string): CheckResult {
  const missing = EXPECTED_PROMPTS.filter(p => !existsSync(join(promptsDir, p)));
  return missing.length === 0
    ? ok('proposal-extract')
    : warn(
        `missing local override(s): ${missing.join(', ')}. The bundled package fallback is still used; re-run \`init --upgrade\` to restore.`
      );
}

function checkIndexFreshness(indexFile: string, nodesDir: string): CheckResult {
  if (!existsSync(indexFile))
    return warn('ENTRY.md missing; run `npx kenkeep index rebuild`.');
  try {
    const parsed = matter(readFileSync(indexFile, 'utf8'));
    const fm = IndexFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) return warn('ENTRY.md frontmatter is invalid; rebuild it.');
    const recorded = fm.data.nodes_hash.startsWith('sha256:')
      ? fm.data.nodes_hash.slice(7)
      : fm.data.nodes_hash;
    return recorded === computeNodesHash(nodesDir)
      ? ok(`fresh (${fm.data.node_count} node(s))`)
      : warn('stale (nodes_hash drift); run `npx kenkeep index rebuild`.');
  } catch (e) {
    return warn(`unreadable: ${(e as Error).message}`);
  }
}

function checkSettings(file: string): CheckResult {
  if (!existsSync(file)) {
    return warn(
      'no .ai/kenkeep/config.yaml, package defaults are in effect. Run `npx kenkeep init --upgrade` to create one.'
    );
  }
  let loaded: unknown;
  try {
    loaded = yaml.load(readFileSync(file, 'utf8'));
  } catch (e) {
    return err(`invalid YAML: ${(e as Error).message}`);
  }
  const parsed = SettingsSchema.safeParse(loaded);
  if (!parsed.success) {
    return err(
      `schema validation failed: ${parsed.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
    );
  }
  const keys = Object.keys(parsed.data).filter(k => k !== 'schema_version').length;
  return ok(`valid (${keys} override(s))`);
}

function checkGitignore(file: string): CheckResult {
  if (!existsSync(file)) return warn('no .gitignore inside .ai/kenkeep/');
  const body = readFileSync(file, 'utf8');
  return body.includes('_sessions/') && body.includes('_logs/')
    ? ok('kenkeep entries present')
    : warn('missing entries for `_sessions/` and/or `_logs/`');
}

const KKIGNORE_WARNING =
  '.kkignore missing or empty. Run `init --upgrade` to regenerate the default stub, or add your own patterns.';

/**
 * Verifies that `.kkignore` exists at the repo root and contains at least one
 * non-comment, non-blank line. The file scopes bootstrap discovery away from
 * vendored or generated trees, so an absent/empty file is load-bearing enough
 * to surface as an advisory warning. ENOENT is treated as the "missing"
 * branch; any other read failure (e.g. EACCES) is surfaced as an error so the
 * user is not silently told the file is missing when it actually exists.
 */
function checkKbignore(file: string): CheckResult {
  let body: string;
  try {
    body = readFileSync(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return warn(KKIGNORE_WARNING);
    return err(`unreadable: ${(e as Error).message}`);
  }
  const hasPattern = body.split(/\r?\n/).some(line => {
    const trimmed = line.trimStart();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });
  return hasPattern ? ok('present with pattern(s)') : warn(KKIGNORE_WARNING);
}
