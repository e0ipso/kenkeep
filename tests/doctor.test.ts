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
    expect(combined).toContain('pre-commit config installed');
    expect(combined).toContain('.gitignore lists ai-knowledge-base paths');
    expect(combined).toContain('settings file is valid');
    expect(combined).toContain('Claude skills installed');
    expect(combined).toContain('kb-add, kb-bootstrap, kb-curate');
  });

  it('warns when a legacy .claude/commands/kb-*.md file is present', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    // Simulate a leftover from an older install.
    const fsMod = await import('node:fs');
    fsMod.mkdirSync(join(sandbox, '.claude/commands'), { recursive: true });
    fsMod.writeFileSync(join(sandbox, '.claude/commands/kb-curate.md'), '# stale\n');

    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0); // warnings only; exits 0.
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('no legacy .claude/commands/kb-*.md');
    expect(combined).toContain('kb-curate.md');
    expect(combined).toContain('init --upgrade');
  });

  it('flags an invalid .config.json as an error', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    writeFileSync(
      join(sandbox, '.ai/knowledge-base/.config.json'),
      JSON.stringify({ schema_version: 1, drainBound: -1 }),
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
    expect(result.stdout).toContain('Additions:       0');
  });
});
