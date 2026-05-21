import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runNodeAdd, writeNewNode } from '../../src/commands/node-add.js';
import { repoPaths } from '../../src/lib/paths.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kb-nodeadd-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/.state'), { recursive: true });
  writeFileSync(
    join(root, '.ai/knowledge-base/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: '@e0ipso/ai-knowledge-base',
      version: '0.0.0-test',
      installed_at: '2026-05-12T10:00:00Z',
      assistants: ['claude'],
    })
  );
  mkdirSync(join(root, '.ai/knowledge-base/nodes/practice'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/nodes/map'), { recursive: true });
  return root;
}

describe('node add', () => {
  let cwd: string;
  let original: string;
  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });
  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('writes a node file directly under nodes/<kind>/ with no proposal block', async () => {
    const paths = repoPaths(cwd);
    const result = await writeNewNode(
      {
        kind: 'practice',
        title: 'Use commit signing for releases',
        summary: 'All releases must be GPG-signed',
        tags: 'releases, gpg',
        body: '# Use commit signing\n\nDetails.',
        relatesTo: '',
        confidence: 'high',
      },
      { paths }
    );
    expect(result.filePath).toBeTruthy();
    const dir = join(cwd, '.ai/knowledge-base/nodes/practice');
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    const fm = matter(readFileSync(join(dir, files[0]!), 'utf8')).data as Record<string, unknown>;
    expect(fm['kind']).toBe('practice');
    expect(fm).not.toHaveProperty('proposal');
    expect(existsSync(join(cwd, '.ai/knowledge-base/INDEX.md'))).toBe(true);
  });

  it('fails loud when an existing node would be overwritten', async () => {
    writeFileSync(
      join(cwd, '.ai/knowledge-base/nodes/practice/practice-use-foo.md'),
      matter.stringify('# Use Foo\nBody.\n', {
        schema_version: 1,
        id: 'practice-use-foo',
        title: 'Use Foo',
        kind: 'practice',
        tags: [],
        derived_from: [],
        relates_to: [],
        confidence: 'high',
        summary: 'orig',
      })
    );
    const paths = repoPaths(cwd);
    await expect(
      writeNewNode(
        {
          kind: 'practice',
          title: 'Use Foo',
          summary: 'Different content',
          tags: '',
          body: 'New body',
          relatesTo: '',
          confidence: 'high',
        },
        { paths }
      )
    ).rejects.toThrow(/already exists/);
    // Original untouched.
    const after = readFileSync(
      join(cwd, '.ai/knowledge-base/nodes/practice/practice-use-foo.md'),
      'utf8'
    );
    expect(after).toContain('Body.');
    expect(after).not.toContain('New body');
    // No second file created.
    expect(readdirSync(join(cwd, '.ai/knowledge-base/nodes/practice')).length).toBe(1);
  });
});

describe('runNodeAdd flag-driven path', () => {
  let cwd: string;
  let original: string;
  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });
  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('writes a node end-to-end from flags + stdin body, no prompts', async () => {
    const code = await runNodeAdd(
      {
        kind: 'practice',
        title: 'Stdin body flow',
        summary: 'Streams the body in over stdin',
        tags: 'cli, flags',
        body: '@-',
        relatesTo: '',
        confidence: 'high',
        yes: true,
      },
      {
        readStdin: async () => '# Stdin body flow\n\nFrom pipe.',
        isTTY: () => false,
      }
    );
    expect(code).toBe(0);
    const dir = join(cwd, '.ai/knowledge-base/nodes/practice');
    const files = readdirSync(dir);
    expect(files).toEqual(['practice-stdin-body-flow.md']);
    const content = readFileSync(join(dir, files[0]!), 'utf8');
    expect(content).toContain('From pipe.');
  });

  it('errors when --yes is set but required flags are missing', async () => {
    const code = await runNodeAdd({ yes: true, kind: 'practice' });
    expect(code).toBe(1);
    expect(existsSync(join(cwd, '.ai/knowledge-base/nodes/practice'))).toBe(true);
    expect(readdirSync(join(cwd, '.ai/knowledge-base/nodes/practice'))).toEqual([]);
  });

  it('errors when --body @- is used with a TTY stdin (no piped input)', async () => {
    const code = await runNodeAdd(
      {
        kind: 'practice',
        title: 'x',
        summary: 'y',
        body: '@-',
        yes: true,
      },
      { isTTY: () => true }
    );
    expect(code).toBe(1);
  });

  it('rejects an out-of-enum --kind', async () => {
    const code = await runNodeAdd({
      kind: 'bogus',
      title: 't',
      summary: 's',
      body: 'b',
      yes: true,
    });
    expect(code).toBe(1);
  });

  it('rejects an out-of-enum --confidence', async () => {
    const code = await runNodeAdd({
      kind: 'practice',
      title: 't',
      summary: 's',
      body: 'b',
      confidence: 'sometimes',
      yes: true,
    });
    expect(code).toBe(1);
  });

  it('defaults confidence to high when unset', async () => {
    const code = await runNodeAdd({
      kind: 'practice',
      title: 'No confidence flag',
      summary: 'defaults',
      body: 'body',
      yes: true,
    });
    expect(code).toBe(0);
    const file = readFileSync(
      join(cwd, '.ai/knowledge-base/nodes/practice/practice-no-confidence-flag.md'),
      'utf8'
    );
    expect(file).toContain('confidence: high');
  });
});
