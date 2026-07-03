import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPackExportCommand } from '../../src/commands/pack-export.js';
import { validatePack } from '../../src/lib/pack.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';
import type { NodeFrontmatter, NodeKind, PackManifest } from '../../src/lib/schemas.js';

// v3 OKF reserved index files: ordinary folder indexes carry no frontmatter;
// only the bundle-root nodes/index.md declares okf_version. Folder summaries
// live in the FOLDER_SUMMARIES.md sidecar (outside the bundle), not here.
function writeIndex(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const body = '# Index\n';
  writeFileSync(
    join(dir, 'index.md'),
    basename(dir) === 'nodes' ? matter.stringify(body, { okf_version: '0.1' }) : body
  );
}

function writeNode(
  root: string,
  relDir: string,
  kind: NodeKind,
  id: string,
  overrides: Partial<NodeFrontmatter> = {}
): void {
  const dir = join(root, '.ai/kenkeep/nodes', relDir);
  writeIndex(dir);
  const fm: NodeFrontmatter = {
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: id,
    title: id,
    type: kind,
    tags: overrides.tags ?? ['pack'],
    kk_derived_from: overrides.kk_derived_from ?? [],
    kk_relates_to: overrides.kk_relates_to ?? [],
    kk_depends_on: overrides.kk_depends_on ?? [],
    kk_confidence: overrides.kk_confidence ?? 'high',
    description: overrides.description ?? `Summary for ${id}.`,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\nBody.\n`, fm));
}

function seedKnowledgeBase(root: string): void {
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/nodes'), { recursive: true });
  writeIndex(join(root, '.ai/kenkeep/nodes'));
  writeFileSync(join(root, '.ai/kenkeep/ENTRY.md'), '# ENTRY should not export\n');
  writeFileSync(join(root, '.ai/kenkeep/GRAPH.md'), '# GRAPH should not export\n');
  writeFileSync(join(root, '.ai/kenkeep/.state/usage.jsonl'), '{}\n');
  writeFileSync(join(root, '.ai/kenkeep/config.yaml'), 'schema_version: 1\n');
  writeNode(root, 'framework', 'practice', 'practice-drupal-services', {
    kk_relates_to: ['map-drupal-hooks'],
  });
  writeNode(root, 'framework', 'map', 'map-drupal-hooks', {
    kk_relates_to: ['practice-drupal-services'],
  });
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

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(relative(root, full).split('\\').join('/'));
      }
    }
  };
  walk(root);
  return out;
}

function snapshotTree(root: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(root).map(file => [file, readFileSync(join(root, file), 'utf8')])
  );
}

describe('pack export command', () => {
  let original: string;
  let sandbox: string;

  beforeEach(() => {
    original = process.cwd();
    sandbox = mkdtempSync(join(tmpdir(), 'kk-pack-export-'));
    process.chdir(sandbox);
    seedKnowledgeBase(sandbox);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(original);
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('exports a publishable pack from options', async () => {
    const result = await capture(() =>
      runPackExportCommand({
        name: 'drupal',
        version: '1.2.0',
        summary: 'Drupal project conventions.',
        homepage: 'https://example.com/drupal',
      })
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Nodes exported: 2');
    const dist = join(sandbox, 'dist');
    const manifest = yaml.load(
      readFileSync(join(dist, 'kenkeep-pack.yaml'), 'utf8')
    ) as PackManifest;
    expect(manifest).toEqual({
      homepage: 'https://example.com/drupal',
      name: 'drupal',
      schema_version: NODE_SCHEMA_VERSION,
      summary: 'Drupal project conventions.',
      version: '1.2.0',
    });
    expect(validatePack(dist).ok).toBe(true);
    expect(readFileSync(join(dist, 'README.md'), 'utf8')).toContain(
      'npx kenkeep pack import <this-repo>'
    );
    expect(existsSync(join(dist, 'knowledge/framework/practice-drupal-services.md'))).toBe(true);
    expect(existsSync(join(dist, 'knowledge/index.md'))).toBe(true);
    expect(existsSync(join(dist, 'ENTRY.md'))).toBe(false);
    expect(existsSync(join(dist, 'GRAPH.md'))).toBe(false);
    expect(existsSync(join(dist, '.state'))).toBe(false);
    expect(existsSync(join(dist, 'config.yaml'))).toBe(false);
  });

  it('prompts for missing required fields and never prompts for schema_version', async () => {
    const prompts: string[] = [];
    const values = new Map([
      ['name', 'drupal'],
      ['version', '1.2.0'],
      ['summary', 'Drupal project conventions.'],
    ]);

    const result = await capture(() =>
      runPackExportCommand({
        prompt: async label => {
          prompts.push(label);
          return values.get(label) ?? '';
        },
      })
    );

    expect(result.code).toBe(0);
    expect(prompts).toEqual(['name', 'version', 'summary']);
    const manifest = yaml.load(
      readFileSync(join(sandbox, 'dist/kenkeep-pack.yaml'), 'utf8')
    ) as PackManifest;
    expect(manifest.schema_version).toBe(NODE_SCHEMA_VERSION);
  });

  it('fails on lint errors and leaves no partial output', async () => {
    writeNode(sandbox, 'broken', 'practice', 'practice-broken', {
      kk_relates_to: ['practice-missing'],
    });

    const result = await capture(() =>
      runPackExportCommand({
        name: 'drupal',
        version: '1.2.0',
        summary: 'Drupal project conventions.',
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('dangling-edge');
    expect(result.stderr).toContain('output was not written');
    expect(existsSync(join(sandbox, 'dist'))).toBe(false);
  });

  it('writes to a custom output directory', async () => {
    const result = await capture(() =>
      runPackExportCommand({
        name: 'drupal',
        version: '1.2.0',
        summary: 'Drupal project conventions.',
        out: 'build/publishable',
      })
    );

    expect(result.code).toBe(0);
    expect(existsSync(join(sandbox, 'build/publishable/kenkeep-pack.yaml'))).toBe(true);
    expect(existsSync(join(sandbox, 'dist'))).toBe(false);
  });

  it('is idempotent when rerun with the same inputs', async () => {
    const opts = {
      name: 'drupal',
      version: '1.2.0',
      summary: 'Drupal project conventions.',
    };
    expect((await capture(() => runPackExportCommand(opts))).code).toBe(0);
    const first = snapshotTree(join(sandbox, 'dist'));
    writeFileSync(join(sandbox, 'dist/extra.txt'), 'stale\n');

    expect((await capture(() => runPackExportCommand(opts))).code).toBe(0);
    const second = snapshotTree(join(sandbox, 'dist'));

    expect(second).toEqual(first);
    expect(existsSync(join(sandbox, 'dist/extra.txt'))).toBe(false);
  });

  it('errors clearly when there is no knowledge base', async () => {
    rmSync(join(sandbox, '.ai/kenkeep/nodes'), { recursive: true, force: true });

    const result = await capture(() =>
      runPackExportCommand({
        name: 'drupal',
        version: '1.2.0',
        summary: 'Drupal project conventions.',
      })
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('nodes/ directory does not exist');
  });
});
