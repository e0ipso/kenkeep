import { execFile } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('Node.js >= 22');
    expect(combined).toContain('installed-version');
    expect(combined).toContain('.gitignore lists kenkeep paths');
    expect(combined).toContain('settings file is valid');
    expect(combined).toContain('Claude skills installed');
    expect(combined).toContain('kk-add, kk-bootstrap, kk-curate');
  });

  it('flags nodes with invalid frontmatter and skips the dangling check', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const dir = join(sandbox, '.ai/kenkeep/nodes');
    mkdirSync(dir, { recursive: true });
    // Missing required `summary` field triggers schema validation failure.
    writeFileSync(
      join(dir, 'practice-broken.md'),
      [
        '---',
        'schema_version: 2',
        'id: practice-broken',
        'title: "broken frontmatter"',
        'kind: practice',
        'tags: []',
        'derived_from: []',
        'relates_to: []',
        'confidence: high',
        '---',
        '',
        'body',
      ].join('\n')
    );

    const result = await runCli(sandbox, ['doctor', '--verbose']);

    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('node frontmatter valid');
    expect(combined).toContain('practice-broken.md');
    expect(combined).toContain('summary');
    expect(combined).toContain('skipped');
  });

  it('reports a missing kk-lint-tick.cjs as an error in the Claude hooks check', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    rmSync(join(sandbox, '.claude/hooks/kk-lint-tick.cjs'));
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('Claude hooks registered');
    expect(combined).toContain('kk-lint-tick.cjs');
  });

  // The `.kkignore present and non-empty` check treats a missing file and a
  // file with no effective pattern lines (only comments, blanks, or a
  // leading-whitespace comment) as equivalent "missing or empty" warnings.
  it('warns when .kkignore has only comments and blank lines (effectively empty)', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeFileSync(join(sandbox, '.kkignore'), '# just a comment\n\n   \n# another\n');
    const result = await runCli(sandbox, ['doctor']);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('.kkignore present and non-empty');
    expect(combined).toContain('.kkignore missing or empty');
    // The warning carries the remediation hint regardless of the cause.
    expect(combined).toContain('`init --upgrade`');
  });

  it('passes when .kkignore has at least one pattern line', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeFileSync(join(sandbox, '.kkignore'), '# header\nnode_modules/\n');
    const result = await runCli(sandbox, ['doctor']);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('.kkignore present and non-empty');
    expect(combined).not.toContain('.kkignore missing or empty');
  });

  it('flags an invalid config.yaml as an error', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeFileSync(
      join(sandbox, '.ai/kenkeep/config.yaml'),
      'schema_version: 1\ncurationThreshold: -1\n'
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
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const result = await runCli(sandbox, ['status']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Practice nodes: 0');
    expect(result.stdout).toContain('Map nodes:      0');
    expect(result.stdout).toContain('Session logs (pending):  0');
  });
});
