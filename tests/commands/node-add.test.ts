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
import { runNodeAdd } from '../../src/commands/node-add.js';

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
    const code = await runNodeAdd({
      preset: {
        kind: 'practice',
        title: 'Use commit signing for releases',
        summary: 'All releases must be GPG-signed',
        tags: 'releases, gpg',
        body: '# Use commit signing\n\nDetails.',
      },
      now: new Date('2026-05-12T10:00:00Z'),
    });
    expect(code).toBe(0);
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
        valid_from: '2026-01-01T00:00:00Z',
        valid_until: null,
        updated: '2026-01-01T00:00:00Z',
        supersedes: null,
        superseded_by: null,
        derived_from: [],
        relates_to: [],
        depends_on: [],
        confidence: 'high',
        summary: 'orig',
      })
    );
    const code = await runNodeAdd({
      preset: {
        kind: 'practice',
        title: 'Use Foo',
        summary: 'Different content',
        tags: '',
        body: 'New body',
      },
      now: new Date('2026-05-12T10:00:00Z'),
    });
    expect(code).toBe(1);
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
