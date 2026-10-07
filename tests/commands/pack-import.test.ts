import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runIndexRebuild } from '../../src/commands/index-rebuild.js';
import { runPackExportCommand } from '../../src/commands/pack-export.js';
import { acquirePackSource, runPackImportCommand } from '../../src/commands/pack-import.js';
import type { AcquiredPack } from '../../src/commands/pack-import.js';
import { readFolderSummaries, writeFolderSummaries } from '../../src/lib/folder-summaries.js';
import { runLint } from '../../src/lib/lint.js';
import { writeNodeFile } from '../../src/lib/nodes.js';
import { unresolvedHrefs } from '../helpers/rendered-links.js';
import { PACK_KNOWLEDGE_DIRNAME } from '../../src/lib/pack.js';
import { readRedirectsLedger, writeRedirectsLedger } from '../../src/lib/redirects.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';
import type { NodeFrontmatter, NodeKind } from '../../src/lib/schemas.js';
import { defaultProjectConfigBody } from '../../src/lib/settings.js';

const exec = promisify(execFile);

const MANIFEST_SUMMARY = 'Drupal project conventions.';
// Authored routing text, distinguishable from the Title-cased `deterministicIntent`
// fallback ("Framework." / "Hooks.") that a lost summary would render instead.
const FRAMEWORK_SUMMARY = 'Service wiring conventions; read when adding a service.';
const HOOKS_SUMMARY = 'Hook implementations; read when reacting to core events.';

function writePackManifest(root: string, overrides: Record<string, unknown> = {}): void {
  const values = {
    name: 'drupal',
    version: '1.2.0',
    schema_version: NODE_SCHEMA_VERSION,
    summary: 'Drupal project conventions.',
    homepage: 'https://example.com/drupal-pack',
    ...overrides,
  };
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${String(value)}`);
  writeFileSync(join(root, 'kenkeep-pack.yaml'), `${lines.join('\n')}\n`);
}

// v3 OKF reserved index files: only the bundle root (pack knowledge/) declares
// okf_version; ordinary folder indexes carry no frontmatter.
function writeIndex(dir: string, opts: { root?: boolean } = {}): void {
  const body = '# Index\n';
  writeFileSync(
    join(dir, 'index.md'),
    opts.root ? matter.stringify(body, { okf_version: '0.1' }) : body
  );
}

function leafFrontmatter(
  kind: NodeKind,
  id: string,
  overrides: Partial<NodeFrontmatter> = {}
): NodeFrontmatter {
  return {
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: id,
    title: id,
    type: kind,
    tags: ['pack'],
    kk_derived_from: [],
    kk_relates_to: [],
    kk_depends_on: [],
    kk_confidence: 'high',
    description: `Summary for ${id}.`,
    ...overrides,
  };
}

function writePackNode(
  packRoot: string,
  relDir: string,
  kind: NodeKind,
  id: string,
  body = '# Body\n',
  overrides: Partial<NodeFrontmatter> = {}
): void {
  const dir = join(packRoot, 'knowledge', relDir);
  mkdirSync(dir, { recursive: true });
  writeIndex(dir);
  writeFileSync(
    join(dir, `${id}.md`),
    matter.stringify(body, leafFrontmatter(kind, id, overrides))
  );
}

// A synthetic private file outside every pack and sandbox. The leaf variant is
// a VALID node whose id matches the link name, so the only thing standing
// between its body and the consumer KB is symlink rejection itself (a malformed
// target would be refused by frontmatter validation for the wrong reason).
const PRIVATE_TOKEN = 'PRIVATE-TOKEN-5f3a9c-do-not-import';

function writePrivateFile(root: string, kind: 'leaf' | 'index'): string {
  const file = join(root, kind === 'leaf' ? 'practice-leaked.md' : 'private-notes.md');
  const body = `# Private\n\n${PRIVATE_TOKEN}\n`;
  writeFileSync(
    file,
    kind === 'leaf' ? matter.stringify(body, leafFrontmatter('practice', 'practice-leaked')) : body
  );
  return file;
}

/** Whether any regular file under `dir` (links are not followed) contains `needle`. */
function treeContains(dir: string, needle: string): boolean {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const stat = lstatSync(full);
    if (stat.isDirectory() && treeContains(full, needle)) return true;
    if (stat.isFile() && readFileSync(full, 'utf8').includes(needle)) return true;
  }
  return false;
}

/** Every regular file under `dir` as `dir`-relative POSIX path -> bytes. */
function readTree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.set(relative(dir, full).split(sep).join('/'), readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

function writePack(root: string): string {
  mkdirSync(join(root, 'knowledge'), { recursive: true });
  writePackManifest(root);
  writeIndex(join(root, 'knowledge'), { root: true });
  writePackNode(root, 'framework', 'practice', 'practice-drupal-services');
  writePackNode(root, 'framework', 'map', 'map-drupal-hooks');
  return root;
}

const LEGACY_FOLDER_SUMMARY = 'service wiring conventions; read when adding a service';

/**
 * A pack published against node schema 2: leaf frontmatter uses the pre-OKF
 * field names, and folder summaries live in `index.md` frontmatter rather than
 * in a sidecar registry, which did not exist yet.
 */
function writeLegacyV2Pack(root: string): void {
  writeFileSync(
    join(root, 'kenkeep-pack.yaml'),
    ['name: legacy', 'schema_version: 2', 'summary: A legacy v2 pack.', 'version: 1.0.0', ''].join(
      '\n'
    )
  );
  const dir = join(root, 'knowledge/framework');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(root, 'knowledge/index.md'),
    matter.stringify('# Index\n', { summary: 'legacy root' })
  );
  writeFileSync(
    join(dir, 'index.md'),
    matter.stringify('# Index\n', { summary: LEGACY_FOLDER_SUMMARY })
  );
  writeFileSync(
    join(dir, 'practice-legacy-thing.md'),
    matter.stringify('# Legacy thing\nBody text.\n', {
      schema_version: 2,
      id: 'practice-legacy-thing',
      title: 'Legacy thing',
      kind: 'practice',
      summary: 'A legacy practice node.',
      tags: ['legacy'],
      derived_from: [],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
    })
  );
}

/**
 * Write the pack's registry at the pack ROOT (sibling of `knowledge/`), where
 * export puts it. Raw frontmatter so a fixture can ship keys that
 * `writeFolderSummaries` would collapse on the way out — root-equivalent keys
 * in particular.
 */
function writePackRegistry(packRoot: string, frontmatter: string[]): void {
  writeFileSync(
    join(packRoot, 'knowledge.FOLDER_SUMMARIES.md'),
    ['---', ...frontmatter, '---', '', '# kenkeep Folder Summaries', ''].join('\n')
  );
}

function writeProjectNode(
  root: string,
  relDir: string,
  kind: NodeKind,
  id: string,
  overrides: Partial<NodeFrontmatter> = {}
): void {
  const dir = join(root, '.ai/kenkeep/nodes', relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.md`),
    matter.stringify(
      '# Existing\n',
      leafFrontmatter(kind, id, { tags: ['existing'], ...overrides })
    )
  );
}

/** Runs git in `cwd` only, never in a repository named by inherited GIT_* variables. */
async function git(cwd: string, args: string[]): Promise<string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  );
  const { stdout } = await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd,
    env,
  });
  return stdout;
}

/** Commits everything under `root`: import refuses a tree git cannot restore. */
async function commitAll(root: string): Promise<void> {
  await git(root, ['add', '-A']);
  await git(root, ['commit', '-q', '--allow-empty', '-m', 'fixture']);
}

async function initSandbox(root: string, gitRoot = root): Promise<void> {
  await git(gitRoot, ['init', '-q']);
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/nodes'), { recursive: true });
  writeFileSync(join(root, 'AGENTS.md'), '# Test repo\n');
  writeFileSync(join(root, '.ai/kenkeep/config.yaml'), defaultProjectConfigBody());
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-06-30T00:00:00.000Z',
      harnesses: ['claude'],
    })
  );
}

async function capture(
  fn: () => Promise<number>
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const outSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += `${args.join(' ')}\n`;
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr += `${args.join(' ')}\n`;
  });
  try {
    return { code: await fn(), stdout, stderr };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

/**
 * Produce a pack the way an author actually would: seed a real knowledge base
 * with nested folders and an authored registry, then run `pack export` against
 * it. Returns the exported pack directory. The source sandbox is pushed onto
 * `cleanup`; `returnTo` is restored as the cwd before returning, because export
 * and import each resolve their repo from `process.cwd()`.
 */
async function exportFixturePack(
  cleanup: string[],
  returnTo: string,
  seed?: (source: string, nodesDir: string) => void
): Promise<string> {
  const source = mkdtempSync(join(tmpdir(), 'kk-pack-source-'));
  cleanup.push(source);
  await initSandbox(source);
  const nodesDir = join(source, '.ai/kenkeep/nodes');
  writeIndex(nodesDir, { root: true });
  writeProjectNode(source, 'framework', 'practice', 'practice-drupal-services');
  writeIndex(join(nodesDir, 'framework'));
  writeProjectNode(source, 'framework/hooks', 'map', 'map-drupal-hooks');
  writeIndex(join(nodesDir, 'framework/hooks'));
  writeFolderSummaries(
    nodesDir,
    new Map([
      ['framework', FRAMEWORK_SUMMARY],
      ['framework/hooks', HOOKS_SUMMARY],
    ])
  );
  seed?.(source, nodesDir);

  const outDir = join(source, 'pack-out');
  process.chdir(source);
  try {
    const exported = await capture(() =>
      runPackExportCommand({
        name: 'drupal',
        version: '1.2.0',
        summary: MANIFEST_SUMMARY,
        out: outDir,
      })
    );
    expect(exported.code).toBe(0);
    expect(exported.stderr).not.toContain('folder-summary:');
  } finally {
    process.chdir(returnTo);
  }
  return outDir;
}

async function createTarball(packRoot: string): Promise<string> {
  const tarball = join(dirname(packRoot), `${basename(packRoot)}.tar.gz`);
  await exec('tar', ['-czf', tarball, '-C', dirname(packRoot), basename(packRoot)]);
  return tarball;
}

function mockFetchSequence(
  responses: Array<{ status: number; body: unknown }>,
  opts: { captureHeaders?: boolean } = {}
): { urls: string[]; headers: NonNullable<RequestInit['headers']>[] } {
  const urls: string[] = [];
  const headers: NonNullable<RequestInit['headers']>[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    urls.push(String(input));
    if (opts.captureHeaders) headers.push(init?.headers ?? {});
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    const ok = next.status >= 200 && next.status < 300;
    return {
      ok,
      status: next.status,
      json: async () => next.body,
      arrayBuffer: async () => {
        if (next.body instanceof Buffer) {
          return next.body.buffer.slice(
            next.body.byteOffset,
            next.body.byteOffset + next.body.byteLength
          );
        }
        throw new Error('body is not a buffer');
      },
    } as Response;
  });
  return { urls, headers };
}

describe('pack import command', () => {
  let original: string;
  let sandbox: string;
  let packRoot = '';
  let extraRoots: string[] = [];

  beforeEach(async () => {
    original = process.cwd();
    sandbox = mkdtempSync(join(tmpdir(), 'kk-pack-import-'));
    process.chdir(sandbox);
    await initSandbox(sandbox);
    packRoot = writePack(mkdtempSync(join(tmpdir(), 'kk-pack-fixture-')));
    extraRoots = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(original);
    rmSync(sandbox, { recursive: true, force: true });
    if (packRoot) rmSync(packRoot, { recursive: true, force: true });
    for (const root of extraRoots) rmSync(root, { recursive: true, force: true });
  });

  const afterCommit = async (
    fn: () => Promise<number>
  ): Promise<{ code: number; stdout: string; stderr: string }> => {
    await commitAll(sandbox);
    return capture(fn);
  };

  it('grafts a valid pack into an isolated branch and rebuilds indexes', async () => {
    const acquired: AcquiredPack = { packRoot, resolvedSource: 'fixture-pack' };

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', { acquireSource: async () => acquired })
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Source: fixture-pack');
    expect(result.stdout).toContain('Destination: nodes/drupal/');
    expect(result.stdout).toContain('Nodes grafted: 2');
    expect(
      existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal/framework/practice-drupal-services.md'))
    ).toBe(true);
    const entry = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(entry).toContain('drupal/');
    const graph = readFileSync(join(sandbox, '.ai/kenkeep/GRAPH.md'), 'utf8');
    expect(graph).toContain('## practice-drupal-services');
  });

  it('uses --as for the destination branch', async () => {
    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        as: 'drupal-seven',
        acquireSource: async () => ({ packRoot, resolvedSource: 'fixture-pack' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Destination: nodes/drupal-seven/');
    expect(
      existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal-seven/framework/map-drupal-hooks.md'))
    ).toBe(true);
  });

  it('aborts when the destination branch already exists', async () => {
    mkdirSync(join(sandbox, '.ai/kenkeep/nodes/drupal'), { recursive: true });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('already exists');
    expect(result.stderr).toContain('--as');
  });

  it('rejects a pack id that collides with a consumer node instead of binding it', async () => {
    // The pack's `map-drupal-hooks` relates to `practice-drupal-services`,
    // which the consumer also has as an unrelated leaf. Silently skipping the
    // pack copy would bind the pack's edge to the consumer's content, so
    // the collision is a human decision: nothing is written.
    writeProjectNode(sandbox, 'existing', 'practice', 'practice-drupal-services');
    writePackNode(packRoot, 'framework', 'map', 'map-drupal-hooks', '# Body\n', {
      kk_relates_to: ['practice-drupal-services'],
    });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('practice-drupal-services');
    expect(result.stderr).toContain('existing/practice-drupal-services.md');
    expect(result.stdout).not.toContain('Nodes grafted');
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal'))).toBe(false);
  });

  it('sets the imported branch summary from the manifest when the pack root index lacks one', async () => {
    rmSync(packRoot, { recursive: true, force: true });
    packRoot = writePack(mkdtempSync(join(tmpdir(), 'kk-pack-fixture-')));

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    // v3 folder summaries live in the committed sidecar, not index.md
    // frontmatter; the imported branch summary falls back to the manifest.
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect(summaries.get('drupal')).toBe('Drupal project conventions.');
  });

  it('carries authored folder summaries through an export/import round trip', async () => {
    const exportedPack = await exportFixturePack(extraRoots, sandbox);

    expect(readFolderSummaries(join(exportedPack, PACK_KNOWLEDGE_DIRNAME))).toEqual(
      new Map([
        ['framework', FRAMEWORK_SUMMARY],
        ['framework/hooks', HOOKS_SUMMARY],
      ])
    );

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot: exportedPack, resolvedSource: 'round-trip' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('has no summary');
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect(summaries.get('drupal')).toBe(MANIFEST_SUMMARY);
    expect(summaries.get('drupal/framework')).toBe(FRAMEWORK_SUMMARY);
    expect(summaries.get('drupal/framework/hooks')).toBe(HOOKS_SUMMARY);

    // The rebuild must see the merged registry: these routing sentences are the
    // authored text, not the Title-cased deterministic fallback.
    const branchIndex = readFileSync(join(sandbox, '.ai/kenkeep/nodes/drupal/index.md'), 'utf8');
    expect(branchIndex).toContain(`for more information on ${FRAMEWORK_SUMMARY}`);
    expect(branchIndex).not.toContain('for more information on Framework.');
    const frameworkIndex = readFileSync(
      join(sandbox, '.ai/kenkeep/nodes/drupal/framework/index.md'),
      'utf8'
    );
    expect(frameworkIndex).toContain(`for more information on ${HOOKS_SUMMARY}`);
    expect(frameworkIndex).not.toContain('for more information on Hooks.');
    const entry = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(entry).toContain(`for more information on ${MANIFEST_SUMMARY}`);
  });

  it('re-keys every folder summary under the --as branch', async () => {
    const exportedPack = await exportFixturePack(extraRoots, sandbox);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        as: 'renamed',
        acquireSource: async () => ({ packRoot: exportedPack, resolvedSource: 'round-trip' }),
      })
    );

    expect(result.code).toBe(0);
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect([...summaries.keys()]).toEqual([
      'renamed',
      'renamed/framework',
      'renamed/framework/hooks',
    ]);
    expect(summaries.get('renamed')).toBe(MANIFEST_SUMMARY);
    expect(summaries.get('renamed/framework')).toBe(FRAMEWORK_SUMMARY);
    expect(summaries.get('renamed/framework/hooks')).toBe(HOOKS_SUMMARY);
    const branchIndex = readFileSync(join(sandbox, '.ai/kenkeep/nodes/renamed/index.md'), 'utf8');
    expect(branchIndex).toContain(`for more information on ${FRAMEWORK_SUMMARY}`);
  });

  it('imports a legacy pack that ships no folder summary registry', async () => {
    expect(existsSync(join(packRoot, 'knowledge.FOLDER_SUMMARIES.md'))).toBe(false);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'legacy-pack' }),
      })
    );

    expect(result.code).toBe(0);
    // log.error prefixes every error line with ✗; no line may carry one.
    expect(result.stderr).not.toContain('✗');
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect([...summaries.keys()]).toEqual(['drupal']);
    expect(summaries.get('drupal')).toBe(MANIFEST_SUMMARY);
  });

  it('reports registry validation warnings on a successful import', async () => {
    writePackNode(packRoot, 'runtime', 'practice', 'practice-runtime-tuning');
    writeFolderSummaries(
      join(packRoot, PACK_KNOWLEDGE_DIRNAME),
      new Map([['framework', FRAMEWORK_SUMMARY]])
    );

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toContain(
      'pack import: folder "runtime" has no summary in knowledge.FOLDER_SUMMARIES.md'
    );
    expect(result.stderr).not.toContain('pack import: folder "framework"');
  });

  it('keeps manifest.summary authoritative over root-equivalent pack keys', async () => {
    // '', '.' and '/' all denote the pack root and all re-key to the destination
    // branch. Collapsing them after the merge instead of during it would let one
    // of them beat the manifest by insertion order.
    writePackRegistry(packRoot, [
      'schema_version: 1',
      'summaries:',
      '  "": Pack root text.',
      '  ".": Pack dot text.',
      '  "/": Pack slash text.',
    ]);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect([...summaries.keys()]).toEqual(['drupal']);
    expect(summaries.get('drupal')).toBe(MANIFEST_SUMMARY);
  });

  it('overwrites stale destination keys while leaving other consumer keys alone', async () => {
    writeProjectNode(sandbox, 'existing', 'practice', 'practice-local-conventions');
    writeFolderSummaries(
      join(sandbox, '.ai/kenkeep/nodes'),
      new Map([
        ['existing', 'Local conventions; read before touching this repo.'],
        ['drupal/framework', 'Stale text from an earlier import.'],
        // The pack no longer carries this folder. Nothing else prunes the
        // on-disk registry, so the import has to drop it or it survives forever.
        ['drupal/removed', 'Text for a folder this pack no longer ships.'],
      ])
    );
    writeFolderSummaries(
      join(packRoot, PACK_KNOWLEDGE_DIRNAME),
      new Map([['framework', FRAMEWORK_SUMMARY]])
    );

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect(summaries.get('existing')).toBe('Local conventions; read before touching this repo.');
    expect(summaries.get('drupal/framework')).toBe(FRAMEWORK_SUMMARY);
    expect(summaries.get('drupal')).toBe(MANIFEST_SUMMARY);
    expect(summaries.has('drupal/removed')).toBe(false);
  });

  it('refuses a legacy v2 pack without --migrate, and says how to proceed', async () => {
    const legacyRoot = mkdtempSync(join(tmpdir(), 'kk-pack-v2-'));
    extraRoots.push(legacyRoot);
    writeLegacyV2Pack(legacyRoot);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        as: 'legacy',
        acquireSource: async () => ({ packRoot: legacyRoot, resolvedSource: 'v2' }),
      })
    );

    // A schema bump is a clean break, so conversion stays opt-in. The refusal
    // has to name the flag: the bare schema-mismatch error does not, and a
    // consumer would otherwise have no way to discover the escape hatch.
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--migrate');
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/legacy'))).toBe(false);
  });

  it('migrates a legacy v2 pack under --migrate, recovering its folder summaries', async () => {
    const legacyRoot = mkdtempSync(join(tmpdir(), 'kk-pack-v2-'));
    extraRoots.push(legacyRoot);
    writeLegacyV2Pack(legacyRoot);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        as: 'legacy',
        migrate: true,
        acquireSource: async () => ({ packRoot: legacyRoot, resolvedSource: 'v2' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('--migrate converted a copy');

    // The node landed at the installed schema, not the legacy one.
    const imported = matter(
      readFileSync(
        join(sandbox, '.ai/kenkeep/nodes/legacy/framework/practice-legacy-thing.md'),
        'utf8'
      )
    );
    expect(imported.data['kk_schema_version']).toBe(NODE_SCHEMA_VERSION);
    expect(imported.data['kk_id']).toBe('practice-legacy-thing');

    // v2 kept folder summaries in index.md frontmatter, so migrating recovers
    // routing text that would otherwise be lost outright.
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect(summaries.get('legacy/framework')).toBe(LEGACY_FOLDER_SUMMARY);
    const branchIndex = readFileSync(join(sandbox, '.ai/kenkeep/nodes/legacy/index.md'), 'utf8');
    expect(branchIndex).toContain(`for more information on ${LEGACY_FOLDER_SUMMARY}`);
  });

  it('never modifies the source when --migrate converts a legacy v2 pack', async () => {
    const legacyRoot = mkdtempSync(join(tmpdir(), 'kk-pack-v2-'));
    extraRoots.push(legacyRoot);
    writeLegacyV2Pack(legacyRoot);
    const manifestBefore = readFileSync(join(legacyRoot, 'kenkeep-pack.yaml'), 'utf8');
    const nodeBefore = readFileSync(
      join(legacyRoot, 'knowledge/framework/practice-legacy-thing.md'),
      'utf8'
    );

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        as: 'legacy',
        migrate: true,
        acquireSource: async () => ({ packRoot: legacyRoot, resolvedSource: 'v2' }),
      })
    );

    expect(result.code).toBe(0);
    // A directory source points at a real directory the user owns; importing
    // must migrate a copy, never rewrite it in place.
    expect(readFileSync(join(legacyRoot, 'kenkeep-pack.yaml'), 'utf8')).toBe(manifestBefore);
    expect(
      readFileSync(join(legacyRoot, 'knowledge/framework/practice-legacy-thing.md'), 'utf8')
    ).toBe(nodeBefore);
    expect(existsSync(join(legacyRoot, 'knowledge.FOLDER_SUMMARIES.md'))).toBe(false);
  });

  it('accepts a pack directory as the source, not only a tarball', async () => {
    const result = await afterCommit(() => runPackImportCommand(packRoot));

    expect(result.code).toBe(0);
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal/index.md'))).toBe(true);
    const summaries = readFolderSummaries(join(sandbox, '.ai/kenkeep/nodes'));
    expect(summaries.get('drupal')).toBe(MANIFEST_SUMMARY);
  });

  it('rejects a source that is neither a directory, a tarball, nor a GitHub ref', async () => {
    const result = await afterCommit(() => runPackImportCommand('not a pack'));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('unsupported pack source');
    expect(result.stderr).toContain('pack directory');
  });

  it('returns validation errors without writing on an invalid pack', async () => {
    rmSync(join(packRoot, 'knowledge'), { recursive: true, force: true });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not a valid kenkeep pack');
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal'))).toBe(false);
  });

  // Every link target below is a valid manifest or node, so following any link
  // would pass validation; only the structural symlink rule refuses the pack.
  it.each(['directory', 'tarball'] as const)(
    'rejects a %s pack with a symlinked manifest, leaf or index before reading it',
    async sourceKind => {
      const privateRoot = mkdtempSync(join(tmpdir(), 'kk-private-'));
      extraRoots.push(privateRoot);
      writePackManifest(privateRoot);
      rmSync(join(packRoot, 'kenkeep-pack.yaml'));
      symlinkSync(join(privateRoot, 'kenkeep-pack.yaml'), join(packRoot, 'kenkeep-pack.yaml'));
      symlinkSync(
        writePrivateFile(privateRoot, 'leaf'),
        join(packRoot, 'knowledge/framework/practice-leaked.md')
      );
      // A leafless branch holding nothing but a linked index.
      mkdirSync(join(packRoot, 'knowledge/empty'), { recursive: true });
      symlinkSync(
        writePrivateFile(privateRoot, 'index'),
        join(packRoot, 'knowledge/empty/index.md')
      );
      const source = sourceKind === 'tarball' ? await createTarball(packRoot) : packRoot;

      const result = await afterCommit(() => runPackImportCommand(source));

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('symlink');
      expect(result.stderr).toContain('kenkeep-pack.yaml');
      expect(result.stderr).toContain('knowledge/framework/practice-leaked.md');
      expect(result.stderr).toContain('knowledge/empty/index.md');
      expect(result.stderr).not.toContain('PackManifestSchema');
      expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal'))).toBe(false);
      expect(treeContains(join(sandbox, '.ai/kenkeep'), PRIVATE_TOKEN)).toBe(false);
    }
  );

  // A consumer edge to an id the pack retired resolves through the merged
  // ledger, so the refreshed link lands on the successor inside the graft.
  it('renders a consumer edge to a pack-retired id as a link to its grafted successor', async () => {
    const consumerNodes = join(sandbox, '.ai/kenkeep/nodes');
    const consumer = writeNodeFile({
      nodesDir: consumerNodes,
      frontmatter: leafFrontmatter('practice', 'practice-consumer-base', {
        kk_relates_to: ['practice-retired'],
      }),
      body: '# Base',
      relDir: 'base',
    });
    expect(readFileSync(consumer, 'utf8')).toContain('](../practice-retired.md)');
    writePackNode(packRoot, 'framework', 'practice', 'practice-new');
    writeRedirectsLedger(join(packRoot, PACK_KNOWLEDGE_DIRNAME), {
      'practice-retired': ['practice-new'],
    });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    const refreshed = readFileSync(consumer, 'utf8');
    expect(refreshed).toContain(
      '- Related: [practice-retired → practice-new](../drupal/framework/practice-new.md)'
    );
    expect(refreshed).not.toContain('../practice-retired.md');
    expect(unresolvedHrefs(consumer)).toEqual([]);
    const lint = runLint({ nodesDir: consumerNodes });
    expect(lint.errors).toEqual([]);
    expect(lint.findings.filter(f => f.rule === 'stale-rendered-link')).toEqual([]);
  });

  // A split leaves `old id -> [new ids]` in the ledger and edges that still
  // cite the old id. Export carries the ledger; import must merge it into the
  // consumer root (the only place the ledger reader looks) or the edge dangles.
  const seedSplitHistory = (_source: string, nodesDir: string): void => {
    writeProjectNode(_source, 'framework', 'practice', 'practice-new');
    writeProjectNode(_source, 'framework', 'practice', 'practice-citing', {
      kk_relates_to: ['practice-retired'],
    });
    writeRedirectsLedger(nodesDir, { 'practice-retired': ['practice-new'] });
  };

  it('carries a split redirect through an export/import round trip', async () => {
    const exportedPack = await exportFixturePack(extraRoots, sandbox, seedSplitHistory);
    expect(readRedirectsLedger(join(exportedPack, PACK_KNOWLEDGE_DIRNAME))).toEqual({
      'practice-retired': ['practice-new'],
    });
    const consumerNodes = join(sandbox, '.ai/kenkeep/nodes');
    writeProjectNode(sandbox, 'existing', 'practice', 'practice-local');
    writeRedirectsLedger(consumerNodes, { 'practice-old-local': ['practice-local'] });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot: exportedPack, resolvedSource: 'round-trip' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Redirects merged: 1');
    expect(readRedirectsLedger(consumerNodes)).toEqual({
      'practice-old-local': ['practice-local'],
      'practice-retired': ['practice-new'],
    });
    // The pack never writes a ledger into the graft branch: the reader only
    // recognizes the bundle root.
    expect(existsSync(join(consumerNodes, 'drupal/.redirects.json'))).toBe(false);
    const lint = runLint({ nodesDir: consumerNodes });
    expect(lint.errors).toEqual([]);
    expect(
      lint.findings.some(
        f => f.rule === 'redirected-edge' && f.message.includes('practice-retired')
      )
    ).toBe(true);
    const graph = readFileSync(join(sandbox, '.ai/kenkeep/GRAPH.md'), 'utf8');
    expect(graph).toContain('## practice-citing');
    expect(graph).toContain('relates_to:** practice-retired');
  });

  it('rejects a pack redirect that maps a retired id differently from the consumer ledger', async () => {
    const exportedPack = await exportFixturePack(extraRoots, sandbox, seedSplitHistory);
    const consumerNodes = join(sandbox, '.ai/kenkeep/nodes');
    writeProjectNode(sandbox, 'existing', 'practice', 'practice-local');
    writeRedirectsLedger(consumerNodes, { 'practice-retired': ['practice-local'] });

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot: exportedPack, resolvedSource: 'round-trip' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('practice-retired');
    expect(result.stderr).toContain('practice-local');
    expect(result.stderr).toContain('practice-new');
    expect(readRedirectsLedger(consumerNodes)).toEqual({ 'practice-retired': ['practice-local'] });
    expect(existsSync(join(consumerNodes, 'drupal'))).toBe(false);
  });

  it('rejects unresolved pack references before grafting, resolving them within pack and consumer', async () => {
    writePackNode(packRoot, 'framework', 'map', 'map-drupal-hooks', '# Body\n', {
      kk_depends_on: ['practice-consumer-base'],
    });

    const dangling = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(dangling.code).toBe(1);
    expect(dangling.stderr).toContain('practice-consumer-base');
    expect(dangling.stderr).toContain('map-drupal-hooks');
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal'))).toBe(false);

    // The same edge resolves once the consumer carries the referenced node: a
    // pack may build on a base the consumer already imported.
    writeProjectNode(sandbox, 'base', 'practice', 'practice-consumer-base');
    const resolved = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(resolved.code).toBe(0);
    expect(resolved.stdout).toContain('Nodes grafted: 2');
    expect(runLint({ nodesDir: join(sandbox, '.ai/kenkeep/nodes') }).errors).toEqual([]);
  });

  it('refreshes rendered links of grafted leaves and consumer leaves that link to them', async () => {
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs/x.md'), '# x\n');
    const consumerNodes = join(sandbox, '.ai/kenkeep/nodes');
    // The consumer leaf links to a pack id before the pack exists (root fallback).
    const consumer = writeNodeFile({
      nodesDir: consumerNodes,
      frontmatter: leafFrontmatter('practice', 'practice-consumer-base', {
        kk_relates_to: ['map-drupal-hooks'],
      }),
      body: '# Base',
      relDir: 'base',
    });
    // Pack leaves rendered where the author had them: depth of knowledge/framework.
    const packNodes = join(packRoot, 'knowledge');
    writeNodeFile({
      nodesDir: packNodes,
      frontmatter: leafFrontmatter('map', 'map-drupal-hooks', {
        kk_derived_from: ['docs/x.md'],
        kk_depends_on: ['practice-consumer-base'],
        kk_relates_to: ['practice-drupal-services'],
      }),
      body: '# Hooks',
      relDir: 'framework',
    });
    const consumerBefore = readFileSync(consumer, 'utf8');

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );
    expect(result.code).toBe(0);

    const grafted = join(consumerNodes, 'drupal/framework/map-drupal-hooks.md');
    const graftedText = readFileSync(grafted, 'utf8');
    expect(graftedText).toContain('[1] [docs/x.md](../../../../../docs/x.md)');
    expect(graftedText).toContain(
      '- Related: [practice-drupal-services](practice-drupal-services.md)'
    );
    expect(graftedText).toContain(
      '- Depends on: [practice-consumer-base](../../base/practice-consumer-base.md)'
    );
    expect(readFileSync(consumer, 'utf8')).not.toBe(consumerBefore);
    expect(readFileSync(consumer, 'utf8')).toContain(
      '- Related: [map-drupal-hooks](../drupal/framework/map-drupal-hooks.md)'
    );
    expect(unresolvedHrefs(grafted)).toEqual([]);
    expect(unresolvedHrefs(consumer)).toEqual([]);
    const lint = runLint({ nodesDir: consumerNodes });
    expect(lint.findings.filter(f => f.rule === 'stale-rendered-link')).toEqual([]);
  });

  it('refuses to start unless git can restore the knowledge base and AGENTS.md', async () => {
    // A kenkeep root nested in a monorepo: git paths are relative to the top level.
    const top = mkdtempSync(join(tmpdir(), 'kk-pack-mono-'));
    extraRoots.push(top);
    const nested = join(top, 'apps/kb');
    await initSandbox(nested, top);
    await commitAll(top);
    writeProjectNode(nested, 'local', 'practice', 'practice-draft');
    writeFileSync(join(nested, 'AGENTS.md'), '# Edited\n');
    process.chdir(nested);
    const acquireSource = async (): Promise<AcquiredPack> => ({ packRoot, resolvedSource: 'p' });

    const dirty = await capture(() => runPackImportCommand('fixture', { acquireSource }));

    expect(dirty.code).toBe(1);
    expect(dirty.stderr).toContain('apps/kb/.ai/kenkeep/nodes/local/practice-draft.md');
    expect(dirty.stderr).toContain('apps/kb/AGENTS.md');
    expect(dirty.stderr).toContain('Commit or stash');
    expect(existsSync(join(nested, '.ai/kenkeep/nodes/drupal'))).toBe(false);

    await commitAll(top);
    const clean = await capture(() => runPackImportCommand('fixture', { acquireSource }));
    expect(clean.code).toBe(0);
    expect(existsSync(join(nested, '.ai/kenkeep/nodes/drupal'))).toBe(true);

    rmSync(join(top, '.git'), { recursive: true, force: true });
    const noGit = await capture(() => runPackImportCommand('fixture', { acquireSource }));
    expect(noGit.code).toBe(1);
    expect(noGit.stderr).toContain('not inside a git work tree');
  });

  /**
   * A consumer with generated catalogs and a stale owned index the next
   * rebuild would remove: the state a failed nested rebuild must put back.
   */
  async function seedRebuiltConsumer(): Promise<{ kkDir: string; stale: string }> {
    const kkDir = join(sandbox, '.ai/kenkeep');
    writeProjectNode(sandbox, 'base', 'practice', 'practice-consumer-base');
    expect((await capture(() => runIndexRebuild())).code).toBe(0);
    const stale = join(kkDir, 'nodes/leafless/index.md');
    mkdirSync(dirname(stale), { recursive: true });
    writeFileSync(stale, '# stale\n');
    return { kkDir, stale };
  }

  // The nested rebuild writes the catalogs and removes stale indexes before
  // its AGENTS.md step can refuse a malformed block. That refusal is known up
  // front, so it is checked before anything is grafted.
  it('refuses to graft when the rebuild would refuse a malformed AGENTS.md block', async () => {
    const { kkDir } = await seedRebuiltConsumer();
    const agents = join(sandbox, 'AGENTS.md');
    const malformed = '# Test repo\n\n<!-- >>> kenkeep:kk-index >>> -->\n';
    writeFileSync(agents, malformed);
    const before = readTree(kkDir);

    const result = await afterCommit(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('malformed');
    expect(result.stderr).toContain('nothing was imported');
    expect(readTree(kkDir)).toEqual(before);
    expect(readFileSync(agents, 'utf8')).toBe(malformed);
  });

  // A failure no preflight foresees lands after the graft has written leaves,
  // catalogs and a stale-index removal. AGENTS.md is the one file the rebuild
  // writes outside .ai/kenkeep, so a read-only repo root makes its last write
  // fail. The printed git commands must undo all of it, so a retry does not
  // fail on "destination exists". Root ignores mode bits.
  it.skipIf(process.getuid?.() === 0)(
    'prints git commands that undo a failed import, after which a retry succeeds',
    async () => {
      const { kkDir } = await seedRebuiltConsumer();
      // The seeding rebuild appended the pointer block; drop it again so the
      // import's rebuild has to write AGENTS.md.
      writeFileSync(join(sandbox, 'AGENTS.md'), '# Test repo\n');
      await commitAll(sandbox);
      const before = readTree(kkDir);
      const acquireSource = async (): Promise<AcquiredPack> => ({ packRoot, resolvedSource: 'p' });

      chmodSync(sandbox, 0o555);
      let failed: Awaited<ReturnType<typeof capture>>;
      try {
        failed = await capture(() => runPackImportCommand('fixture', { acquireSource }));
      } finally {
        chmodSync(sandbox, 0o755);
      }

      expect(failed.code).toBe(1);
      expect(failed.stderr).toContain('EACCES');
      expect(existsSync(join(kkDir, 'nodes/drupal'))).toBe(true);
      expect(existsSync(join(kkDir, 'nodes/leafless/index.md'))).toBe(false);
      const undo = failed.stderr
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('git '));
      expect(undo).toHaveLength(2);
      for (const command of undo) await git(sandbox, command.split(' ').slice(1));

      expect(readTree(kkDir)).toEqual(before);
      expect(await git(sandbox, ['status', '--porcelain'])).toBe('');

      const retry = await afterCommit(() => runPackImportCommand('fixture', { acquireSource }));
      expect(retry.code).toBe(0);
      expect(readFileSync(join(kkDir, 'ENTRY.md'), 'utf8')).toContain('drupal');
    }
  );
});

describe('pack source acquisition', () => {
  let tmp: string;
  let packRoot: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'kk-pack-acquire-'));
    packRoot = writePack(join(tmp, 'wrapped-pack'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('extracts a local .tar.gz and locates the wrapped pack root', async () => {
    const tarball = await createTarball(packRoot);
    const acquired = await acquirePackSource(tarball, join(tmp, 'extract-local'));

    expect(acquired.resolvedSource).toBe(tarball);
    expect(existsSync(join(acquired.packRoot, 'kenkeep-pack.yaml'))).toBe(true);
  });

  it('resolves GitHub shorthand to the latest release tarball first', async () => {
    const tarball = readFileSync(await createTarball(packRoot));
    const { urls } = mockFetchSequence([
      { status: 200, body: { tarball_url: 'https://download.example/release.tar.gz' } },
      { status: 200, body: tarball },
    ]);

    const acquired = await acquirePackSource('e0ipso/kenkeep-pack-drupal', join(tmp, 'gh-release'));

    expect(urls[0]).toBe('https://api.github.com/repos/e0ipso/kenkeep-pack-drupal/releases/latest');
    expect(urls[1]).toBe('https://download.example/release.tar.gz');
    expect(acquired.resolvedSource).toContain('e0ipso/kenkeep-pack-drupal');
    expect(existsSync(join(acquired.packRoot, 'kenkeep-pack.yaml'))).toBe(true);
  });

  it('falls back to the default branch tarball when there is no latest release', async () => {
    const tarball = readFileSync(await createTarball(packRoot));
    const { urls } = mockFetchSequence([
      { status: 404, body: {} },
      { status: 200, body: { default_branch: 'main' } },
      { status: 200, body: tarball },
    ]);

    const acquired = await acquirePackSource(
      'https://www.github.com/e0ipso/kenkeep-pack-drupal',
      join(tmp, 'gh-default')
    );

    expect(urls[0]).toBe('https://api.github.com/repos/e0ipso/kenkeep-pack-drupal/releases/latest');
    expect(urls[1]).toBe('https://api.github.com/repos/e0ipso/kenkeep-pack-drupal');
    expect(urls[2]).toBe('https://api.github.com/repos/e0ipso/kenkeep-pack-drupal/tarball/main');
    expect(existsSync(join(acquired.packRoot, 'kenkeep-pack.yaml'))).toBe(true);
  });

  it('requests GitHub source tarballs with application/vnd.github+json', async () => {
    const tarball = readFileSync(await createTarball(packRoot));
    const { headers } = mockFetchSequence(
      [
        { status: 200, body: { tarball_url: 'https://api.github.com/repos/o/r/tarball/v1' } },
        { status: 200, body: tarball },
      ],
      { captureHeaders: true }
    );

    await acquirePackSource('o/r', join(tmp, 'gh-headers'));

    expect(headers[1]).toEqual({ Accept: 'application/vnd.github+json' });
  });
});
