import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquirePackSource, runPackImportCommand } from '../../src/commands/pack-import.js';
import type { AcquiredPack } from '../../src/commands/pack-import.js';
import type { NodeFrontmatter, NodeKind } from '../../src/lib/schemas.js';
import { defaultProjectConfigBody } from '../../src/lib/settings.js';

const exec = promisify(execFile);

function writePackManifest(root: string, overrides: Record<string, unknown> = {}): void {
  const values = {
    name: 'drupal',
    version: '1.2.0',
    schema_version: 2,
    summary: 'Drupal project conventions.',
    homepage: 'https://example.com/drupal-pack',
    ...overrides,
  };
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${String(value)}`);
  writeFileSync(join(root, 'kenkeep-pack.yaml'), `${lines.join('\n')}\n`);
}

function writeIndex(dir: string, summary?: string): void {
  const frontmatter: Record<string, unknown> = {
    schema_version: 2,
    nodes_hash: 'sha256:test',
    node_count: 1,
  };
  if (summary !== undefined) frontmatter.summary = summary;
  writeFileSync(join(dir, 'index.md'), matter.stringify('# Index\n', frontmatter));
}

function writePackNode(
  packRoot: string,
  relDir: string,
  kind: NodeKind,
  id: string,
  body = '# Body\n'
): void {
  const dir = join(packRoot, 'knowledge', relDir);
  mkdirSync(dir, { recursive: true });
  writeIndex(dir, `${relDir} summary`);
  const fm: NodeFrontmatter = {
    schema_version: 2,
    id,
    title: id,
    kind,
    tags: ['pack'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: `Summary for ${id}.`,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(body, fm));
}

function writePack(root: string, opts: { rootSummary?: string | undefined } = {}): string {
  mkdirSync(join(root, 'knowledge'), { recursive: true });
  writePackManifest(root);
  writeIndex(join(root, 'knowledge'), opts.rootSummary);
  writePackNode(root, 'framework', 'practice', 'practice-drupal-services');
  writePackNode(root, 'framework', 'map', 'map-drupal-hooks');
  return root;
}

function writeProjectNode(root: string, relDir: string, kind: NodeKind, id: string): void {
  const dir = join(root, '.ai/kenkeep/nodes', relDir);
  mkdirSync(dir, { recursive: true });
  const fm: NodeFrontmatter = {
    schema_version: 2,
    id,
    title: id,
    kind,
    tags: ['existing'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: `Summary for ${id}.`,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify('# Existing\n', fm));
}

async function initSandbox(root: string): Promise<void> {
  await exec('git', ['init', '-q'], { cwd: root });
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

async function createTarball(packRoot: string): Promise<string> {
  const tarball = join(dirname(packRoot), `${basename(packRoot)}.tar.gz`);
  await exec('tar', ['-czf', tarball, '-C', dirname(packRoot), basename(packRoot)]);
  return tarball;
}

function mockFetchSequence(
  responses: Array<{ status: number; body: unknown }>,
  opts: { captureHeaders?: boolean } = {}
): { urls: string[]; headers: HeadersInit[] } {
  const urls: string[] = [];
  const headers: HeadersInit[] = [];
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

  beforeEach(async () => {
    original = process.cwd();
    sandbox = mkdtempSync(join(tmpdir(), 'kk-pack-import-'));
    process.chdir(sandbox);
    await initSandbox(sandbox);
    packRoot = writePack(mkdtempSync(join(tmpdir(), 'kk-pack-fixture-')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(original);
    rmSync(sandbox, { recursive: true, force: true });
    if (packRoot) rmSync(packRoot, { recursive: true, force: true });
  });

  it('grafts a valid pack into an isolated branch and rebuilds indexes', async () => {
    const acquired: AcquiredPack = { packRoot, resolvedSource: 'fixture-pack' };

    const result = await capture(() =>
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
    const result = await capture(() =>
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

    const result = await capture(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('already exists');
    expect(result.stderr).toContain('--as');
  });

  it('skips colliding ids and reports them without aborting', async () => {
    writeProjectNode(sandbox, 'existing', 'practice', 'practice-drupal-services');

    const result = await capture(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Nodes grafted: 1');
    expect(result.stdout).toContain('Nodes skipped: 1');
    expect(result.stderr).toContain('practice-drupal-services');
    expect(
      existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal/framework/practice-drupal-services.md'))
    ).toBe(false);
    expect(
      existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal/framework/map-drupal-hooks.md'))
    ).toBe(true);
  });

  it('sets the imported branch summary from the manifest when the pack root index lacks one', async () => {
    rmSync(packRoot, { recursive: true, force: true });
    packRoot = writePack(mkdtempSync(join(tmpdir(), 'kk-pack-fixture-')), {
      rootSummary: undefined,
    });

    const result = await capture(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(0);
    const index = matter(
      readFileSync(join(sandbox, '.ai/kenkeep/nodes/drupal/index.md'), 'utf8')
    ).data;
    expect(index.summary).toBe('Drupal project conventions.');
  });

  it('returns validation errors without writing on an invalid pack', async () => {
    rmSync(join(packRoot, 'knowledge'), { recursive: true, force: true });

    const result = await capture(() =>
      runPackImportCommand('fixture', {
        acquireSource: async () => ({ packRoot, resolvedSource: 'p' }),
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not a valid kenkeep pack');
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/drupal'))).toBe(false);
  });
});

describe('pack source acquisition', () => {
  let tmp: string;
  let packRoot: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'kk-pack-acquire-'));
    packRoot = writePack(join(tmp, 'wrapped-pack'), { rootSummary: 'Wrapped summary.' });
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
