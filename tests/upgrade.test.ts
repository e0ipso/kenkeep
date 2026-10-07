import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from './helpers.js';

const exec = promisify(execFile);

/**
 * Writes one leaf into the sandbox knowledge base. `relDir` is a POSIX folder
 * relative to `nodes/`; the empty string writes a loose leaf at the root.
 */
function writeLeaf(
  sandbox: string,
  relDir: string,
  id: string,
  opts: { tags?: string[]; relates_to?: string[] } = {}
): void {
  const nodes = join(sandbox, '.ai/kenkeep/nodes');
  const dir = relDir === '' ? nodes : join(nodes, relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.md`),
    matter.stringify('Body.', {
      kk_schema_version: 3,
      kk_id: id,
      title: id,
      type: 'practice',
      description: 's',
      tags: opts.tags ?? [],
      kk_derived_from: [],
      kk_relates_to: opts.relates_to ?? [],
      kk_confidence: 'high',
    })
  );
}

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

  // A scoped upgrade merges into the recorded inventory, so a Claude-only
  // repair never drops Codex while its registrations stay in place. Nothing is
  // removed implicitly.
  it('keeps every recorded harness in the inventory when the upgrade names only one', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude,codex']);
    const codexHooks = readFileSync(join(sandbox, '.codex/hooks.json'), 'utf8');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);

    const installed = JSON.parse(
      readFileSync(join(sandbox, '.ai/kenkeep/.state/installed-version'), 'utf8')
    ) as { harnesses: string[] };
    expect(installed.harnesses).toEqual(['claude', 'codex']);
    expect(readFileSync(join(sandbox, '.codex/hooks.json'), 'utf8')).toBe(codexHooks);
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/codex/kk-capture.cjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.agents/skills/kk-curate/SKILL.md'))).toBe(true);
  });

  it('fails and keeps the recorded version when a recorded harness config is malformed', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude,codex']);
    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const recorded = readFileSync(versionFile, 'utf8');
    // Codex stays in the inventory, so its config is rewritten even when the
    // upgrade names only claude; its writer refuses the malformed file.
    writeFileSync(join(sandbox, '.codex/hooks.json'), '{"hooks": 5}\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('.codex/hooks.json');
    expect(readFileSync(join(sandbox, '.codex/hooks.json'), 'utf8')).toBe('{"hooks": 5}\n');
    expect(readFileSync(versionFile, 'utf8')).toBe(recorded);
  });

  it('honors a committed session-retention opt-in instead of re-ignoring _sessions/ on upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const kkGitignore = join(sandbox, '.ai/kenkeep/.gitignore');
    const shipped = readFileSync(kkGitignore, 'utf8');
    expect(shipped).toContain('/_sessions/\n');
    // The supported opt-in: replace the ignore rule with its negation.
    writeFileSync(kkGitignore, shipped.replace('/_sessions/\n', '!/_sessions/\n'));

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);

    const lines = readFileSync(kkGitignore, 'utf8').split('\n');
    expect(lines).toContain('!/_sessions/');
    expect(lines).not.toContain('/_sessions/');
    expect(lines).toContain('/_logs/');
    expect(lines).toContain('/hooks/');

    // git agrees: a session log is trackable after the upgrade.
    const logRel = '.ai/kenkeep/_sessions/20260101-0000-retained.md';
    mkdirSync(join(sandbox, '.ai/kenkeep/_sessions'), { recursive: true });
    writeFileSync(join(sandbox, logRel), '---\nschema_version: 1\n---\n');
    const check = spawnSync('git', ['check-ignore', '-q', logRel], { cwd: sandbox });
    expect(check.status).toBe(1);
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
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/claude/kk-capture.cjs'))).toBe(true);

    // installed-version bumped to current.
    const after = JSON.parse(readFileSync(versionFile, 'utf8'));
    expect(after.version).not.toBe('0.0.0-test-old');
  });

  it('overwrites a stale kk-curate skill with the shared root-detector body on upgrade', async () => {
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
    expect(skill).toContain('node .ai/kenkeep/scripts/kk-detect-root.mjs');
    expect(skill).not.toContain('Bash(rm:*)');
    expect(skill).not.toMatch(/^allowed-tools:/m);

    // kk-migrate refreshed: the shipped body references the shared root detector
    // and the `place` primitive flow, and the stale stub is gone.
    const migrateSkill = readFileSync(migrateSkillFile, 'utf8');
    expect(migrateSkill).toContain('node .ai/kenkeep/scripts/kk-detect-root.mjs');
    expect(migrateSkill).toContain('place apply');
    expect(migrateSkill).not.toContain('stale');
  });

  it('re-copies the notification icon when missing on upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const icon = join(sandbox, '.ai/kenkeep/assets/notification-icon.png');
    expect(existsSync(icon)).toBe(true);
    rmSync(icon);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(icon)).toBe(true);
  });

  it('ships the root-detector helper on first install and re-copies it when missing on upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const helper = join(sandbox, '.ai/kenkeep/scripts/kk-detect-root.mjs');
    expect(existsSync(helper)).toBe(true);
    rmSync(helper);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(helper)).toBe(true);
    expect(readFileSync(helper, 'utf8')).toContain('kk-detect-root');
  });

  it('does not overwrite a user-edited root-detector helper on upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const helper = join(sandbox, '.ai/kenkeep/scripts/kk-detect-root.mjs');
    const customized = '// user edit root\n';
    writeFileSync(helper, customized);

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(helper, 'utf8')).toBe(customized);
  });

  it('anchors the shared ignore entries to the bundle root on upgrade, pruning legacy unanchored variants and preserving local entries', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const kkGitignore = join(sandbox, '.ai/kenkeep/.gitignore');
    // Simulate a project written by a pre-anchoring kenkeep: unanchored dir
    // patterns (the `hooks/` footgun also ignores the nodes/hooks/ branch).
    writeFileSync(
      kkGitignore,
      '_sessions/\n_logs/\n.state/*\n!.state/installed-version\ncustom/\n'
    );

    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    const lines = readFileSync(kkGitignore, 'utf8').split('\n');
    // Anchored to the bundle root so nodes/hooks/ (a knowledge branch) stays tracked.
    expect(lines).toContain('/hooks/');
    // Legacy unanchored variants are replaced, not left alongside the anchored ones.
    expect(lines).not.toContain('hooks/');
    expect(lines).not.toContain('_sessions/');
    expect(lines).not.toContain('_logs/');
    // User-owned entries are preserved.
    expect(lines).toContain('custom/');
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
    // doctor's claude adapter probes `claude --version`; provide a stub on
    // PATH so the CLI check passes hermetically (CI has no real harness
    // binary) and the asserted exit code reflects only the version warning.
    const stubBin = writeHarnessBinaryStubs(sandbox);
    const env: NodeJS.ProcessEnv = { PATH: `${stubBin}:${process.env['PATH'] ?? ''}` };
    await runCli(sandbox, ['init', '--harnesses', 'claude'], env);
    const versionFile = join(sandbox, '.ai/kenkeep/.state/installed-version');
    const installed = JSON.parse(readFileSync(versionFile, 'utf8'));
    installed.version = '0.0.0-test-old';
    writeFileSync(versionFile, JSON.stringify(installed, null, 2) + '\n');

    const result = await runCli(sandbox, ['doctor'], env);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toMatch(/installed-version/);
    expect(combined).toMatch(/installed 0\.0\.0-test-old/);
    expect(combined).toMatch(/init --upgrade/);
  });
  it('files a loose root leaf into the folder its edges name', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeLeaf(sandbox, 'harnesses', 'practice-anchor', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-loose', {
      tags: ['harness'],
      relates_to: ['practice-anchor'],
    });

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    expect(result.exitCode).toBe(0);
    const nodes = join(sandbox, '.ai/kenkeep/nodes');
    expect(existsSync(join(nodes, 'practice-loose.md'))).toBe(false);
    expect(existsSync(join(nodes, 'harnesses/practice-loose.md'))).toBe(true);
    expect(result.stdout + result.stderr).toMatch(/Filed 1 loose leaf/);
  });

  it('deletes a tracked root leaf that matches no folder and prints its git restore', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeLeaf(sandbox, 'harnesses', 'practice-anchor', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-orphan', { tags: ['matches-nothing-anywhere'] });
    await exec('git', ['add', '-A'], { cwd: sandbox });
    await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'base'], {
      cwd: sandbox,
    });

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    expect(result.exitCode).toBe(0);
    const orphan = join(sandbox, '.ai/kenkeep/nodes/practice-orphan.md');
    expect(existsSync(orphan)).toBe(false);
    const combined = result.stdout + result.stderr;
    expect(combined).toMatch(/Deleted 1 leaf matching no folder/);
    expect(combined).toMatch(/restore: git restore -- \.ai\/kenkeep\/nodes\/practice-orphan\.md/);
    await exec('git', ['restore', '--', '.ai/kenkeep/nodes/practice-orphan.md'], { cwd: sandbox });
    expect(existsSync(orphan)).toBe(true);
  });

  // Upgrade runs the same protected sweep as `node sweep`.
  it('keeps an untracked unplaceable leaf and a referenced one at the root', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeLeaf(sandbox, 'harnesses', 'practice-anchor', {
      tags: ['harness'],
      relates_to: ['practice-referenced'],
    });
    writeLeaf(sandbox, '', 'practice-referenced', { tags: ['matches-nothing-anywhere'] });
    writeLeaf(sandbox, '', 'practice-novel', { tags: ['matches-nothing-anywhere'] });
    const novel = join(sandbox, '.ai/kenkeep/nodes/practice-novel.md');
    const novelBytes = readFileSync(novel, 'utf8');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).not.toMatch(/Deleted/);
    expect(combined).toMatch(/Kept 2 leaves matching no folder/);
    expect(combined).toMatch(/practice-novel\.md \(.*git cannot restore/);
    expect(combined).toMatch(/practice-referenced\.md \(.*other nodes reference it/);
    expect(readFileSync(novel, 'utf8')).toBe(novelBytes);
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/practice-referenced.md'))).toBe(true);

    const lint = await runCli(sandbox, ['lint']);
    expect(lint.stdout + lint.stderr).toMatch(/^dangling-edge: 0$/m);
  });

  it('leaves a tree with no folders untouched, deleting nothing', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeLeaf(sandbox, '', 'practice-only-leaf', { tags: ['alone'] });

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(sandbox, '.ai/kenkeep/nodes/practice-only-leaf.md'))).toBe(true);
    expect(result.stdout + result.stderr).not.toMatch(/Deleted/);
  });

  it('stages nothing when it sweeps', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeLeaf(sandbox, 'harnesses', 'practice-anchor', { tags: ['harness'] });
    await exec('git', ['add', '-A'], { cwd: sandbox });
    await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'base'], {
      cwd: sandbox,
    });
    writeLeaf(sandbox, '', 'practice-loose', {
      tags: ['harness'],
      relates_to: ['practice-anchor'],
    });

    await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    const staged = await exec('git', ['diff', '--cached', '--name-only'], { cwd: sandbox });
    expect(staged.stdout.trim()).toBe('');
  });
});
