import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('init', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('creates the knowledge-base skeleton', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized.');

    const expected = [
      '.ai/knowledge-base/README.md',
      '.ai/knowledge-base/INDEX.md',
      '.ai/knowledge-base/GRAPH.md',
      '.ai/knowledge-base/nodes/practice/.gitkeep',
      '.ai/knowledge-base/nodes/map/.gitkeep',
      '.ai/knowledge-base/_sessions/.gitkeep',
      '.ai/knowledge-base/_logs/proposal/.gitkeep',
      '.ai/knowledge-base/_logs/curator/.gitkeep',
      '.ai/knowledge-base/_logs/bootstrap-incremental/.gitkeep',
      '.claude/settings.json',
      '.claude/skills/kb-add/SKILL.md',
      '.claude/skills/kb-bootstrap/SKILL.md',
      '.claude/skills/kb-curate/SKILL.md',
      '.claude/hooks/kb-capture.mjs',
      '.claude/hooks/kb-proposal-drain.mjs',
      '.claude/hooks/kb-session-start.mjs',
      '.ai/knowledge-base/.state/installed-version',
      '.ai/knowledge-base/.config/prompts/proposal-extract.md',
      '.ai/knowledge-base/.config/prompts/curator.md',
      '.ai/knowledge-base/.config/prompts/bootstrap-incremental.md',
      '.ai/knowledge-base/config.yaml',
      '.gitignore',
    ];

    for (const rel of expected) {
      expect(existsSync(join(sandbox, rel)), `expected ${rel}`).toBe(true);
    }

    // _proposed/ must not be created — the architecture writes directly to nodes/.
    expect(existsSync(join(sandbox, '.ai/knowledge-base/_proposed'))).toBe(false);
  });

  it('stamps installed-version with current package version', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    const installed = JSON.parse(
      readFileSync(join(sandbox, '.ai/knowledge-base/.state/installed-version'), 'utf8')
    );
    expect(installed.schema_version).toBe(1);
    expect(installed.package).toBe('@e0ipso/ai-knowledge-base');
    expect(typeof installed.version).toBe('string');
    expect(installed.version.length).toBeGreaterThan(0);
    expect(installed.harnesses).toEqual(['claude']);
    expect(typeof installed.installed_at).toBe('string');
  });

  it('appends an idempotent block to .gitignore', async () => {
    writeFileSync(join(sandbox, '.gitignore'), 'node_modules\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const first = readFileSync(join(sandbox, '.gitignore'), 'utf8');
    expect(first).toContain('node_modules');
    expect(first).toContain('# >>> @e0ipso/ai-knowledge-base >>>');
    expect(first).toContain('.ai/knowledge-base/_sessions/');

    // Re-run with --force; gitignore should not pick up duplicate blocks.
    await runCli(sandbox, ['init', '--harnesses', 'claude', '--force']);
    const second = readFileSync(join(sandbox, '.gitignore'), 'utf8');
    const occurrences = second.match(/>>> @e0ipso\/ai-knowledge-base >>>/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('refuses to overwrite without --force', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const second = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(second.exitCode).toBe(0);
    expect(second.stdout + second.stderr).toContain('Already initialized');
  });

  it('rejects unsupported assistants', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'cursor']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/cursor|Unsupported assistant/i);
  });

  it('installs the shared skill bytes identically across claude, codex, and opencode', async () => {
    const result = await runCli(sandbox, [
      'init',
      '--harnesses',
      'claude,codex,opencode',
    ]);
    expect(result.exitCode).toBe(0);
    const claudeSkill = readFileSync(
      join(sandbox, '.claude/skills/kb-curate/SKILL.md'),
      'utf8'
    );
    const codexSkill = readFileSync(
      join(sandbox, '.agents/skills/kb-curate/SKILL.md'),
      'utf8'
    );
    const openCodeSkill = readFileSync(
      join(sandbox, '.opencode/skills/kb-curate/SKILL.md'),
      'utf8'
    );
    expect(claudeSkill).toBe(codexSkill);
    expect(codexSkill).toBe(openCodeSkill);
    expect(claudeSkill).toContain('/tmp/kb-detect-harness.mjs');
    expect(existsSync(join(sandbox, '.opencode/plugins/kb.mjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.opencode/kb-hooks/kb-capture.mjs'))).toBe(true);
  });

  it('succeeds in a repo without a package.json and produces no husky/secretlint artefacts', async () => {
    expect(existsSync(join(sandbox, 'package.json'))).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(sandbox, '.ai/knowledge-base'))).toBe(true);
    expect(existsSync(join(sandbox, '.claude'))).toBe(true);

    expect(existsSync(join(sandbox, '.husky'))).toBe(false);
    expect(existsSync(join(sandbox, '.secretlintrc.json'))).toBe(false);
    expect(existsSync(join(sandbox, '.lintstagedrc.cjs'))).toBe(false);
    expect(existsSync(join(sandbox, 'package.json'))).toBe(false);
  });

  it('registers Stop, SessionEnd, and PreCompact capture hooks in .claude/settings.json', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };
    expect(settings.hooks).toBeDefined();
    for (const event of ['Stop', 'SessionEnd', 'PreCompact']) {
      const entries = settings.hooks?.[event];
      expect(entries, `expected hook entry for ${event}`).toBeDefined();
      expect(entries?.[0]?.hooks[0]?.command).toBe(
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"'
      );
    }
  });

  it('registers SessionStart drain (async) and session-start (sync) hooks', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<
        string,
        Array<{ hooks: Array<{ type: string; command: string; async?: boolean }> }>
      >;
    };
    const entries = settings.hooks?.['SessionStart'];
    expect(entries, 'expected SessionStart hook entries').toBeDefined();
    expect(entries).toHaveLength(2);
    const commands = entries?.flatMap(e =>
      e.hooks.map(h => ({ command: h.command, async: h.async }))
    );
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-proposal-drain.mjs"',
          async: true,
        }),
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-session-start.mjs"',
        }),
      ])
    );
  });

  it('emits every owned hook command with the $CLAUDE_PROJECT_DIR prefix', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const ownedEvents = ['Stop', 'SessionEnd', 'PreCompact', 'SessionStart'] as const;
    for (const event of ownedEvents) {
      const entries = settings.hooks?.[event] ?? [];
      const flat = entries.flatMap(e => e.hooks);
      expect(flat.length, `expected hook entries for ${event}`).toBeGreaterThan(0);
      for (const h of flat) {
        expect(h.command).toContain('"$CLAUDE_PROJECT_DIR/.claude/hooks/');
      }
    }
  });

  it('emitted Stop hook command loads when invoked from a subdirectory CWD', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const stopCommand = settings.hooks?.['Stop']?.[0]?.hooks[0]?.command;
    expect(stopCommand).toBeDefined();

    // Hooks ship as bundles that still depend on a few externals (e.g. zod).
    // In a consumer install these resolve through npm-installed transitive
    // deps; the sandbox has no node_modules of its own, so point Node at the
    // workspace tree by symlinking it.
    symlinkSync(join(repoRoot, 'node_modules'), join(sandbox, 'node_modules'), 'dir');

    const subdir = join(sandbox, 'nested/leaf');
    mkdirSync(subdir, { recursive: true });

    const result = spawnSync('sh', ['-c', stopCommand as string], {
      cwd: subdir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox },
      encoding: 'utf8',
      input: '',
    });

    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(combined).not.toContain('MODULE_NOT_FOUND');
    expect(combined).not.toContain('Cannot find module');
  });

  it('writes a default config.yaml populated with defaults', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const body = yaml.load(
      readFileSync(join(sandbox, '.ai/knowledge-base/config.yaml'), 'utf8')
    ) as Record<string, unknown>;
    expect(body['schema_version']).toBe(1);
    expect(body['curationThreshold']).toBe(5);
    expect(body['logsRetentionDays']).toBe(30);
    expect(body['lintEveryNSessions']).toBe(50);
    expect(Object.keys(body).sort()).toEqual(
      ['curationThreshold', 'lintEveryNSessions', 'logsRetentionDays', 'schema_version']
    );
  });

  it('registers both SessionEnd capture and lint-tick hooks and ships kb-lint-tick.mjs', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(existsSync(join(sandbox, '.claude/hooks/kb-lint-tick.mjs'))).toBe(true);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };
    const sessionEnd = settings.hooks?.['SessionEnd'] ?? [];
    const commands = sessionEnd.flatMap(e => e.hooks.map(h => h.command));
    expect(commands).toEqual(
      expect.arrayContaining([
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"',
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-lint-tick.mjs"',
      ])
    );
  });

  it('re-running init --force preserves a single set of SessionEnd entries (no duplicates)', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    await runCli(sandbox, ['init', '--harnesses', 'claude', '--force']);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const sessionEnd = settings.hooks?.['SessionEnd'] ?? [];
    const commands = sessionEnd.flatMap(e => e.hooks.map(h => h.command));
    const captureCount = commands.filter(
      c => c === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"'
    ).length;
    const lintCount = commands.filter(
      c => c === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-lint-tick.mjs"'
    ).length;
    expect(captureCount).toBe(1);
    expect(lintCount).toBe(1);
  });

  it('does not overwrite an existing config.yaml even with --force', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const configFile = join(sandbox, '.ai/knowledge-base/config.yaml');
    const customized = 'schema_version: 1\ncurationThreshold: 99\n';
    writeFileSync(configFile, customized);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--force']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(customized);
    expect(result.stdout + result.stderr).toContain('config.yaml already exists');
  });
});
