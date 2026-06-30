import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSchemaCommand } from '../../src/commands/schema.js';
import { runValidateCommand } from '../../src/commands/validate.js';
import { SCHEMA_NAMES } from '../../src/lib/schema-registry.js';

async function capture(
  fn: () => Promise<number>
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr += args.join(' ') + '\n';
  });
  try {
    const code = await fn();
    return { code, stdout, stderr };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

describe('kk schema', () => {
  it('prints JSON Schema derived from the named Zod contract', async () => {
    const { code, stdout } = await capture(() => runSchemaCommand({ name: 'node' }));
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    // Shape sanity, not a golden dump: the projection is an object schema with
    // the persisted node's required fields surfacing somewhere in the document.
    expect(typeof parsed).toBe('object');
    expect(stdout).toContain('schema_version');
    expect(stdout).toContain('confidence');
  });

  it('exposes the curator-output array contract', async () => {
    const { code, stdout } = await capture(() => runSchemaCommand({ name: 'curator-output' }));
    expect(code).toBe(0);
    expect(stdout).toContain('"array"');
  });

  it('exposes the pack-manifest object contract', async () => {
    const { code, stdout } = await capture(() => runSchemaCommand({ name: 'pack-manifest' }));
    expect(code).toBe(0);
    expect(stdout).toContain('"name"');
    expect(stdout).toContain('schema_version');
  });

  it('exits non-zero and lists names for an unknown schema', async () => {
    const { code, stderr } = await capture(() => runSchemaCommand({ name: 'nope' }));
    expect(code).toBe(1);
    for (const name of SCHEMA_NAMES) expect(stderr).toContain(name);
  });
});

describe('kk validate', () => {
  let cwd: string;
  let original: string;

  beforeEach(() => {
    original = process.cwd();
    cwd = mkdtempSync(join(tmpdir(), 'kk-validate-'));
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  const validProposedNode = {
    title: 'Use foo',
    kind: 'practice',
    tags: ['foo'],
    summary: 'one line',
    body: 'body text',
    confidence: 'high',
    relates_to: [],
    depends_on: [],
  };

  it('accepts a valid artifact and exits 0', async () => {
    const file = join(cwd, 'good.json');
    writeFileSync(file, JSON.stringify(validProposedNode));
    const { code, stdout } = await capture(() =>
      runValidateCommand({ name: 'proposed-node', file })
    );
    expect(code).toBe(0);
    expect(stdout).toContain('proposed-node: valid');
  });

  it('accepts a valid pack manifest YAML artifact', async () => {
    const file = join(cwd, 'kenkeep-pack.yaml');
    writeFileSync(
      file,
      [
        'name: drupal',
        'version: 1.2.0',
        'schema_version: 2',
        'summary: Drupal project conventions.',
        'homepage: https://example.com/drupal-pack',
      ].join('\n')
    );
    const { code, stdout } = await capture(() =>
      runValidateCommand({ name: 'pack-manifest', file })
    );
    expect(code).toBe(0);
    expect(stdout).toContain('pack-manifest: valid');
  });

  it('rejects an invalid artifact with a path-referenced error', async () => {
    const file = join(cwd, 'bad.json');
    // Missing required `confidence`, wrong type for `tags`.
    writeFileSync(
      file,
      JSON.stringify({ ...validProposedNode, confidence: undefined, tags: 'foo' })
    );
    const { code, stderr } = await capture(() =>
      runValidateCommand({ name: 'proposed-node', file })
    );
    expect(code).toBe(1);
    expect(stderr).toContain('tags');
  });

  it('fails on input that is neither JSON nor YAML', async () => {
    const file = join(cwd, 'notjson.json');
    writeFileSync(file, 'name: [unterminated');
    const { code, stderr } = await capture(() => runValidateCommand({ name: 'node', file }));
    expect(code).toBe(1);
    expect(stderr).toContain('not valid JSON or YAML');
  });

  it('exits non-zero for an unknown schema name', async () => {
    const file = join(cwd, 'any.json');
    writeFileSync(file, '{}');
    const { code, stderr } = await capture(() => runValidateCommand({ name: 'nope', file }));
    expect(code).toBe(1);
    expect(stderr).toContain('unknown schema');
  });
});
