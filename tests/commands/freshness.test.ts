import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

function git(cwd: string, args: string[]): Promise<unknown> {
  return exec('git', args, { cwd });
}

function nodeMarkdown(id: string, body: string): string {
  return matter.stringify(body, {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    description: 's',
    tags: [],
    kk_derived_from: [],
    kk_relates_to: [],
    kk_confidence: 'high',
  });
}

async function commit(root: string, rel: string, content: string, msg: string): Promise<void> {
  const abs = join(root, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
  await git(root, ['add', '--', rel]);
  await git(root, ['commit', '-q', '-m', msg]);
}

describe('freshness command', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox('kk-freshness-cmd-');
    await git(sandbox, ['init', '-q']);
    await git(sandbox, ['config', 'user.email', 'test@example.com']);
    await git(sandbox, ['config', 'user.name', 'Test']);
    await git(sandbox, ['config', 'commit.gpgsign', 'false']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('reports and lists a node whose referenced code changed since curation', async () => {
    await commit(sandbox, 'src/foo.ts', 'v1', 'foo v1');
    await commit(
      sandbox,
      '.ai/kenkeep/nodes/topic/practice-a.md',
      nodeMarkdown('practice-a', 'Describes `src/foo.ts`.'),
      'add node'
    );
    await commit(sandbox, 'src/foo.ts', 'v2', 'foo v2');

    const result = await runCli(sandbox, ['freshness', '--verbose']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain(
      '1 of 1 node(s) may describe code that changed since curation'
    );
    expect(result.stdout + result.stderr).toContain('topic: 1');
    expect(result.stdout + result.stderr).toContain('practice-a — changed: src/foo.ts');
  });

  it('reports all-fresh when no referenced code changed after curation', async () => {
    await commit(sandbox, 'src/bar.ts', 'v1', 'bar v1');
    await commit(
      sandbox,
      '.ai/kenkeep/nodes/topic/practice-b.md',
      nodeMarkdown('practice-b', 'Describes `src/bar.ts`.'),
      'add node'
    );

    const result = await runCli(sandbox, ['freshness']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain('appear fresh');
  });

  it('prints a clean no-signal line and exits 0 on an empty knowledge base', async () => {
    await commit(sandbox, 'src/foo.ts', 'v1', 'foo v1');
    const result = await runCli(sandbox, ['freshness']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain('no signal');
  });
});
