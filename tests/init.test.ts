import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);

describe('init', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('creates the knowledge-base skeleton', async () => {
    const result = await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized.');

    const expected = [
      '.ai/knowledge-base/README.md',
      '.ai/knowledge-base/INDEX.md',
      '.ai/knowledge-base/GRAPH.md',
      '.ai/knowledge-base/nodes/practice/.gitkeep',
      '.ai/knowledge-base/nodes/map/.gitkeep',
      '.ai/knowledge-base/_proposed/additions/.gitkeep',
      '.ai/knowledge-base/_proposed/modifications/.gitkeep',
      '.ai/knowledge-base/_proposed/contradictions/.gitkeep',
      '.ai/knowledge-base/_sessions/.gitkeep',
      '.ai/knowledge-base/_logs/stage-2/.gitkeep',
      '.ai/knowledge-base/_logs/curator/.gitkeep',
      '.ai/knowledge-base/_logs/bootstrap-incremental/.gitkeep',
      '.claude/settings.json',
      '.claude/skills/kb-add/SKILL.md',
      '.claude/skills/kb-bootstrap/SKILL.md',
      '.claude/skills/kb-curate/SKILL.md',
      '.claude/hooks/kb-capture.mjs',
      '.claude/hooks/kb-stage2-drain.mjs',
      '.claude/hooks/kb-session-start.mjs',
      '.ai/knowledge-base/.state/installed-version',
      '.ai/knowledge-base/.state/prompts/stage-2-extract.md',
      '.ai/knowledge-base/.state/prompts/curator.md',
      '.ai/knowledge-base/.state/prompts/bootstrap-incremental.md',
      '.ai/knowledge-base/.config.json',
      '.pre-commit-config.yaml',
      '.gitignore',
    ];

    for (const rel of expected) {
      expect(existsSync(join(sandbox, rel)), `expected ${rel}`).toBe(true);
    }
  });

  it('stamps installed-version with current package version', async () => {
    const result = await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(result.exitCode).toBe(0);

    const installed = JSON.parse(
      readFileSync(join(sandbox, '.ai/knowledge-base/.state/installed-version'), 'utf8'),
    );
    expect(installed.schema_version).toBe(1);
    expect(installed.package).toBe('@e0ipso/ai-knowledge-base');
    expect(typeof installed.version).toBe('string');
    expect(installed.version.length).toBeGreaterThan(0);
    expect(installed.assistants).toEqual(['claude']);
    expect(typeof installed.installed_at).toBe('string');
    expect(installed.layout_version).toBe(2);
  });

  it('appends an idempotent block to .gitignore', async () => {
    writeFileSync(join(sandbox, '.gitignore'), 'node_modules\n');

    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const first = readFileSync(join(sandbox, '.gitignore'), 'utf8');
    expect(first).toContain('node_modules');
    expect(first).toContain('# >>> @e0ipso/ai-knowledge-base >>>');
    expect(first).toContain('.ai/knowledge-base/_sessions/');

    // Re-run with --force; gitignore should not pick up duplicate blocks.
    await runCli(sandbox, ['init', '--assistants', 'claude', '--force']);
    const second = readFileSync(join(sandbox, '.gitignore'), 'utf8');
    const occurrences = second.match(/>>> @e0ipso\/ai-knowledge-base >>>/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('refuses to overwrite without --force', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const second = await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(second.exitCode).toBe(0);
    expect(second.stdout + second.stderr).toContain('Already initialized');
  });

  it('rejects unsupported assistants', async () => {
    const result = await runCli(sandbox, ['init', '--assistants', 'cursor']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/cursor|Unsupported assistant/i);
  });

  it('does not overwrite an existing .pre-commit-config.yaml', async () => {
    const existing = 'repos:\n  - repo: local\n    hooks: []\n';
    writeFileSync(join(sandbox, '.pre-commit-config.yaml'), existing);

    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const after = readFileSync(join(sandbox, '.pre-commit-config.yaml'), 'utf8');
    expect(after).toBe(existing);
  });

  it('registers Stop, SessionEnd, and PreCompact capture hooks in .claude/settings.json', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };
    expect(settings.hooks).toBeDefined();
    for (const event of ['Stop', 'SessionEnd', 'PreCompact']) {
      const entries = settings.hooks?.[event];
      expect(entries, `expected hook entry for ${event}`).toBeDefined();
      expect(entries?.[0]?.hooks[0]?.command).toBe(
        `KB_BUILDER_HOOK=${event} node .claude/hooks/kb-capture.mjs`,
      );
    }
  });

  it('registers SessionStart drain (async) and session-start (sync) hooks', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<
        string,
        Array<{ hooks: Array<{ type: string; command: string; async?: boolean }> }>
      >;
    };
    const entries = settings.hooks?.['SessionStart'];
    expect(entries, 'expected SessionStart hook entries').toBeDefined();
    expect(entries).toHaveLength(2);
    const commands = entries?.flatMap((e) =>
      e.hooks.map((h) => ({ command: h.command, async: h.async })),
    );
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-stage2-drain.mjs',
          async: true,
        }),
        expect.objectContaining({
          command: 'KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-session-start.mjs',
        }),
      ]),
    );
  });

  it('writes a default .config.json populated with defaults', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const body = JSON.parse(
      readFileSync(join(sandbox, '.ai/knowledge-base/.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(body['schema_version']).toBe(1);
    expect(body['drainBound']).toBe(5);
    expect(body['maxAttempts']).toBe(3);
    expect(body['stage2Timeout']).toBe(60000);
    expect(body['indexBudgetTokens']).toBe(2000);
    expect(body['curationThreshold']).toBe(5);
    expect(body['bootstrapTokenBudget']).toBe(10000);
    expect(body['logsRetentionDays']).toBe(30);
  });

  it('does not overwrite an existing .config.json even with --force', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const configFile = join(sandbox, '.ai/knowledge-base/.config.json');
    const customized = JSON.stringify({ schema_version: 1, drainBound: 99 }, null, 2) + '\n';
    writeFileSync(configFile, customized);

    const result = await runCli(sandbox, ['init', '--assistants', 'claude', '--force']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(customized);
    expect(result.stdout + result.stderr).toContain('.config.json already exists');
  });

  it('ships the rename — no references to the old `kb-builder` binary in copied prompts', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    const skill = readFileSync(join(sandbox, '.claude/skills/kb-bootstrap/SKILL.md'), 'utf8');
    expect(skill).not.toMatch(/\bkb-builder proposals/);
    expect(skill).toContain('ai-knowledge-base proposals review');
  });

  it('cleans up legacy .claude/commands/kb-*.md files left by older installs', async () => {
    // Simulate an older install: drop the legacy slash-command markdown
    // alongside the soon-to-be-installed skills tree.
    const legacyCommandsDir = join(sandbox, '.claude/commands');
    const fsMod = await import('node:fs');
    fsMod.mkdirSync(legacyCommandsDir, { recursive: true });
    fsMod.writeFileSync(join(legacyCommandsDir, 'kb-add.md'), '# stale\n');
    fsMod.writeFileSync(join(legacyCommandsDir, 'kb-bootstrap.md'), '# stale\n');
    fsMod.writeFileSync(join(legacyCommandsDir, 'kb-curate.md'), '# stale\n');
    // A user-authored slash command that init should NOT touch.
    fsMod.writeFileSync(join(legacyCommandsDir, 'my-own.md'), '# user\n');

    const result = await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(legacyCommandsDir, 'kb-add.md'))).toBe(false);
    expect(existsSync(join(legacyCommandsDir, 'kb-bootstrap.md'))).toBe(false);
    expect(existsSync(join(legacyCommandsDir, 'kb-curate.md'))).toBe(false);
    expect(existsSync(join(legacyCommandsDir, 'my-own.md'))).toBe(true);

    // New skills tree is present.
    expect(existsSync(join(sandbox, '.claude/skills/kb-add/SKILL.md'))).toBe(true);
    expect(existsSync(join(sandbox, '.claude/skills/kb-bootstrap/SKILL.md'))).toBe(true);
    expect(existsSync(join(sandbox, '.claude/skills/kb-curate/SKILL.md'))).toBe(true);
  });

  it('does not create the legacy `.ai/.kb-builder/` directory for fresh installs', async () => {
    await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(existsSync(join(sandbox, '.ai/.kb-builder'))).toBe(false);
    expect(existsSync(join(sandbox, '.ai/knowledge-base/.state'))).toBe(true);
  });

  it('migrates a legacy `.ai/.kb-builder/` install to `.ai/knowledge-base/.state/`', async () => {
    // Simulate a legacy install: state files live under .ai/.kb-builder/.
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(sandbox, '.ai/.kb-builder/prompts'), { recursive: true });
    writeFileSync(
      join(sandbox, '.ai/.kb-builder/installed-version'),
      JSON.stringify(
        {
          schema_version: 1,
          package: '@e0ipso/ai-knowledge-base',
          version: '0.0.0-test-legacy',
          installed_at: '2026-01-01T00:00:00Z',
          assistants: ['claude'],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(sandbox, '.ai/.kb-builder/state.json'),
      JSON.stringify({ schema_version: 1, last_nudged_at: '2026-01-01T00:00:00Z' }),
    );
    writeFileSync(
      join(sandbox, '.ai/.kb-builder/bootstrap-state.json'),
      JSON.stringify({ schema_version: 1, docs: {} }),
    );
    writeFileSync(join(sandbox, '.ai/.kb-builder/prompts/curator.md'), '# legacy local override\n');

    // Doctor auto-migrates.
    const result = await runCli(sandbox, ['doctor']);
    // Exit code is non-fatal (warnings only); migration message present.
    expect(result.stdout + result.stderr).toMatch(/state layout migrated/i);

    // New layout exists.
    expect(existsSync(join(sandbox, '.ai/knowledge-base/.state/installed-version'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/knowledge-base/.state/state.json'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/knowledge-base/.state/bootstrap-state.json'))).toBe(true);
    expect(
      readFileSync(join(sandbox, '.ai/knowledge-base/.state/prompts/curator.md'), 'utf8'),
    ).toBe('# legacy local override\n');

    // Legacy directory is removed.
    expect(existsSync(join(sandbox, '.ai/.kb-builder'))).toBe(false);
  });
});
