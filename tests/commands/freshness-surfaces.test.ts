import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from '../helpers.js';

const exec = promisify(execFile);

function git(cwd: string, args: string[]): Promise<unknown> {
  return exec('git', args, { cwd });
}

function writeNode(sandbox: string, id: string, body: string): void {
  const abs = join(sandbox, '.ai/kenkeep/nodes/topic', `${id}.md`);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(
    abs,
    matter.stringify(body, {
      kk_schema_version: 3,
      kk_id: id,
      title: id,
      type: 'practice',
      description: 's',
      tags: [],
      kk_derived_from: [],
      kk_relates_to: [],
      kk_confidence: 'high',
    })
  );
}

describe('freshness surfaced in doctor and status', () => {
  let sandbox: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    sandbox = makeSandbox('kk-freshness-surf-');
    await git(sandbox, ['init', '-q']);
    await git(sandbox, ['config', 'user.email', 'test@example.com']);
    await git(sandbox, ['config', 'user.name', 'Test']);
    await git(sandbox, ['config', 'commit.gpgsign', 'false']);
    const stubBin = writeHarnessBinaryStubs(sandbox);
    env = { PATH: `${stubBin}:${process.env['PATH'] ?? ''}` };
    await runCli(sandbox, ['init', '--harnesses', 'claude'], env);
    // Commit source, then the node that references it, then change the source.
    mkdirSync(join(sandbox, 'src'), { recursive: true });
    writeFileSync(join(sandbox, 'src/foo.ts'), 'v1');
    await git(sandbox, ['add', '-A']);
    await git(sandbox, ['commit', '-q', '-m', 'init + source']);
    writeNode(sandbox, 'practice-a', 'Describes `src/foo.ts`.');
    await git(sandbox, ['add', '-A']);
    await git(sandbox, ['commit', '-q', '-m', 'add node']);
    writeFileSync(join(sandbox, 'src/foo.ts'), 'v2');
    await git(sandbox, ['add', '-A']);
    await git(sandbox, ['commit', '-q', '-m', 'change source']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('doctor reports the freshness advisory as a warning and still exits 0', async () => {
    const result = await runCli(sandbox, ['doctor'], env);
    expect(result.exitCode).toBe(0); // advisory warn never fails doctor
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('nodes describe current code');
    expect(combined).toContain('may describe code changed since curation');
  });

  it('status reports the flagged-node count', async () => {
    const result = await runCli(sandbox, ['status'], env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain('Nodes describing changed code: 1');
  });
});
