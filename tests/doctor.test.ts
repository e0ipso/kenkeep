import { execFile } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from './helpers.js';

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

  // Parametrized over every adapter with stub binaries on PATH: the suite
  // must not require any real harness CLI (parity — no adapter is a more
  // equal citizen in CI), and every adapter's doctorChecks() implementation
  // gets exercised, not just the first registered one.
  it.each(['claude', 'codex', 'copilot', 'cursor', 'opencode'])(
    'passes core checks after init [%s]',
    async id => {
      const stubBin = writeHarnessBinaryStubs(sandbox);
      const env: NodeJS.ProcessEnv = { PATH: `${stubBin}:${process.env['PATH'] ?? ''}` };
      if (id === 'copilot') env['COPILOT_HOME'] = join(sandbox, 'copilot-home');
      await runCli(sandbox, ['init', '--harnesses', id], env);
      const result = await runCli(sandbox, ['doctor'], env);
      expect(result.exitCode).toBe(0);
      const combined = result.stdout + result.stderr;
      expect(combined).toContain('Node.js >= 22');
      expect(combined).toContain('installed-version');
      expect(combined).toContain('.gitignore lists kenkeep paths');
      expect(combined).toContain('settings file is valid');
      expect(combined).toContain('skills installed');
      expect(combined).toContain('kk-add, kk-bootstrap, kk-curate, kk-migrate');
    }
  );

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

  it('surfaces the migrate hint (not a crash) on a legacy flat nodes/<kind>/ layout', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    // Recreate the old flat layout: a nodes/practice/ bucket holding a leaf and
    // no per-folder index.md. The reader rejects this as OldLayoutError.
    const flatDir = join(sandbox, '.ai/kenkeep/nodes/practice');
    mkdirSync(flatDir, { recursive: true });
    writeFileSync(
      join(flatDir, 'practice-old.md'),
      [
        '---',
        'schema_version: 1',
        'id: practice-old',
        'title: "legacy node"',
        'kind: practice',
        'tags: []',
        'derived_from: []',
        'relates_to: []',
        'confidence: high',
        'summary: legacy',
        '---',
        '',
        'body',
      ].join('\n')
    );

    const result = await runCli(sandbox, ['doctor']);

    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('node frontmatter valid');
    expect(combined).toContain('migrate');
    // The dangling check is skipped because nodes cannot be enumerated.
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

  it('warns and exits nonzero when uninitialized', async () => {
    const result = await runCli(sandbox, ['status']);
    // Exit 1 so `npx kenkeep status && ...` can detect an uninitialized
    // repo, consistent with every other user-facing command.
    expect(result.exitCode).toBe(1);
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
