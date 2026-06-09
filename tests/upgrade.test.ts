import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);

describe('init --upgrade', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('errors when the repo is not initialized', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/Not initialized/i);
  });

  it('runs idempotently when already current', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Upgraded to/);
  });

  it('refreshes hooks but preserves a customized config.yaml', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const configFile = join(sandbox, '.ai/kenkeep/config.yaml');
    const customized = 'schema_version: 1\ncurationThreshold: 42\n';
    writeFileSync(configFile, customized);

    // Mark installed-version older so upgrade applies.
    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Upgraded to/);

    // config.yaml untouched.
    expect(readFileSync(configFile, 'utf8')).toBe(customized);

    // Hooks present.
    expect(existsSync(join(sandbox, '.claude/hooks/kk-capture.cjs'))).toBe(true);

    // installed-version bumped to current.
    const after = JSON.parse(readFileSync(versionFile, 'utf8'));
    expect(after.version).not.toBe('0.0.0-test-old');
  });

  it('overwrites a stale kk-curate skill with the shared detect-harness body on upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    // Pre-populate the installed skill with stale content (the older
    // per-harness skill once carried `allowed-tools`; the shared body
    // does not). Upgrade must overwrite the file with the shared bytes.
    const skillFile = join(sandbox, '.claude/skills/kk-curate/SKILL.md');
    writeFileSync(
      skillFile,
      '---\nname: kk-curate\nallowed-tools: Bash(rm:*), Read, Edit, Write\n---\nold\n'
    );
    // kk-migrate ships and refreshes through the same shared-skills path; stub it
    // stale too and assert upgrade restores the shipped body alongside kk-curate.
    const migrateSkillFile = join(sandbox, '.claude/skills/kk-migrate/SKILL.md');
    writeFileSync(migrateSkillFile, '---\nname: kk-migrate\n---\nstale\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);

    const skill = readFileSync(skillFile, 'utf8');
    expect(skill).toContain('/tmp/kk-detect-harness.mjs');
    expect(skill).toContain('--harness "$HARNESS"');
    expect(skill).not.toContain('Bash(rm:*)');
    expect(skill).not.toMatch(/^allowed-tools:/m);

    // kk-migrate refreshed: the shipped body carries the harness heredoc and the
    // `place` primitive flow, and the stale stub is gone.
    const migrateSkill = readFileSync(migrateSkillFile, 'utf8');
    expect(migrateSkill).toContain('/tmp/kk-detect-harness.mjs');
    expect(migrateSkill).toContain('place apply');
    expect(migrateSkill).not.toContain('stale');
  });

  it('re-copies a missing prompt during upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const promptFile = join(sandbox, '.ai/kenkeep/.config/prompts/proposal-extract.md');
    rmSync(promptFile);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(promptFile)).toBe(true);
  });

  it('preserves byte-for-byte edits to config.yaml and a prompt across repeated upgrades', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const configFile = join(sandbox, '.ai/kenkeep/config.yaml');
    const promptFile = join(sandbox, '.ai/kenkeep/.config/prompts/proposal-extract.md');

    const editedConfig = readFileSync(configFile, 'utf8') + '# local edit\n';
    writeFileSync(configFile, editedConfig);

    const editedPrompt = readFileSync(promptFile, 'utf8') + '\n<!-- local marker -->\n';
    writeFileSync(promptFile, editedPrompt);

    const first = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(first.exitCode).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(editedConfig);
    expect(readFileSync(promptFile, 'utf8')).toBe(editedPrompt);

    const second = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(second.exitCode).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(editedConfig);
    expect(readFileSync(promptFile, 'utf8')).toBe(editedPrompt);
  });

  it('creates config.yaml on upgrade when missing', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const configFile = join(sandbox, '.ai/kenkeep/config.yaml');
    rmSync(configFile);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(configFile)).toBe(true);
    const body = yaml.load(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
    expect(body.schema_version).toBe(1);
    expect(body.curationThreshold).toBe(20);
  });
});

describe('doctor: installed-version currency', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when installed-version is older than the package', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toMatch(/installed-version/);
    expect(combined).toMatch(/installed 0\.0\.0-test-old/);
    expect(combined).toMatch(/init --upgrade/);
  });
});
