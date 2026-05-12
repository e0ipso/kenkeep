import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);

describe('doctor', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('flags missing installed-version as an error before init', async () => {
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toContain('installed-version');
  });

  it('passes core checks after init', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('Node.js >= 22');
    expect(combined).toContain('installed-version');
    expect(combined).toContain('commit-time secret scan wired');
    expect(combined).toContain('.gitignore lists ai-knowledge-base paths');
    expect(combined).toContain('settings file is valid');
    expect(combined).toContain('Claude skills installed');
    expect(combined).toContain('kb-add, kb-bootstrap, kb-curate');
  });

  it('flags an invalid config.yaml as an error', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    writeFileSync(
      join(sandbox, '.ai/knowledge-base/config.yaml'),
      'schema_version: 1\ndrainBound: -1\n'
    );
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toContain('settings file is valid');
    expect(result.stdout + result.stderr).toContain('schema validation failed');
  });
});

describe('status', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('warns when uninitialized', async () => {
    const result = await runCli(sandbox, ['status']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain('not initialized');
  });

  it('reports zeros after init', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const result = await runCli(sandbox, ['status']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Practice nodes: 0');
    expect(result.stdout).toContain('Map nodes:      0');
    expect(result.stdout).toContain('Stage-2 queue:           0');
    expect(result.stdout).toContain('Curator conflicts:       0');
  });
});
