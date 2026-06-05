import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
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

  it('creates the kenkeep skeleton', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized.');

    const expected = [
      '.ai/kenkeep/README.md',
      '.ai/kenkeep/INDEX.md',
      '.ai/kenkeep/GRAPH.md',
      '.ai/kenkeep/nodes/index.md',
      '.ai/kenkeep/_sessions/.gitkeep',
      '.ai/kenkeep/_logs/proposal/.gitkeep',
      '.ai/kenkeep/_logs/curator/.gitkeep',
      '.ai/kenkeep/_logs/bootstrap-incremental/.gitkeep',
      '.claude/settings.json',
      '.claude/skills/kk-add/SKILL.md',
      '.claude/skills/kk-bootstrap/SKILL.md',
      '.claude/skills/kk-curate/SKILL.md',
      '.claude/hooks/kk-capture.cjs',
      '.claude/hooks/kk-proposal-drain.cjs',
      '.claude/hooks/kk-session-start.cjs',
      '.ai/kenkeep/.state/installed-version',
      '.ai/kenkeep/.config/prompts/proposal-extract.md',
      '.ai/kenkeep/config.yaml',
      '.ai/kenkeep/.gitignore',
    ];

    for (const rel of expected) {
      expect(existsSync(join(sandbox, rel)), `expected ${rel}`).toBe(true);
    }

    // _proposed/ must not be created — the architecture writes directly to nodes/.
    expect(existsSync(join(sandbox, '.ai/kenkeep/_proposed'))).toBe(false);
  });

  it('stamps installed-version with current package version', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    const installed = JSON.parse(
      readFileSync(join(sandbox, '.ai/kenkeep/.state/installed-version'), 'utf8')
    );
    expect(installed.schema_version).toBe(1);
    expect(installed.package).toBe('kenkeep');
    expect(typeof installed.version).toBe('string');
    expect(installed.version.length).toBeGreaterThan(0);
    expect(installed.harnesses).toEqual(['claude']);
    expect(typeof installed.installed_at).toBe('string');
  });

  it('writes .ai/kenkeep/.gitignore and leaves the project .gitignore untouched', async () => {
    const projectGitignore = join(sandbox, '.gitignore');
    writeFileSync(projectGitignore, 'node_modules\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const kkGitignore = join(sandbox, '.ai/kenkeep/.gitignore');
    const kkBody = readFileSync(kkGitignore, 'utf8');
    expect(kkBody).toContain('_sessions/');
    expect(kkBody).toContain('_logs/');
    expect(kkBody).toContain('.state/');
    expect(kkBody).toContain('!.state/installed-version');

    const projectBody = readFileSync(projectGitignore, 'utf8');
    expect(projectBody).toBe('node_modules\n');
    expect(projectBody).not.toContain('kenkeep');
  });

  it('refuses to overwrite when already initialized', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const second = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(second.exitCode).toBe(0);
    expect(second.stdout + second.stderr).toContain('Already initialized');
  });

  it('rejects unsupported harness ids', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'not-a-harness']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/not-a-harness|Unsupported/i);
  });

  it('installs the shared skill bytes identically across all four harnesses', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude,codex,cursor,opencode']);
    expect(result.exitCode).toBe(0);
    const claudeSkill = readFileSync(join(sandbox, '.claude/skills/kk-curate/SKILL.md'), 'utf8');
    const codexSkill = readFileSync(join(sandbox, '.agents/skills/kk-curate/SKILL.md'), 'utf8');
    const cursorSkill = readFileSync(join(sandbox, '.cursor/skills/kk-curate/SKILL.md'), 'utf8');
    const openCodeSkill = readFileSync(
      join(sandbox, '.opencode/skills/kk-curate/SKILL.md'),
      'utf8'
    );
    expect(claudeSkill).toBe(codexSkill);
    expect(codexSkill).toBe(cursorSkill);
    expect(cursorSkill).toBe(openCodeSkill);
    expect(claudeSkill).toContain('/tmp/kk-detect-harness.mjs');
    expect(existsSync(join(sandbox, '.opencode/plugins/kk.mjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.opencode/kk-hooks/kk-capture.cjs'))).toBe(true);
  });

  it('succeeds in a repo without a package.json and produces no husky artefacts', async () => {
    expect(existsSync(join(sandbox, 'package.json'))).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(sandbox, '.ai/kenkeep'))).toBe(true);
    expect(existsSync(join(sandbox, '.claude'))).toBe(true);

    expect(existsSync(join(sandbox, '.husky'))).toBe(false);
    expect(existsSync(join(sandbox, '.lintstagedrc.cjs'))).toBe(false);
    expect(existsSync(join(sandbox, 'package.json'))).toBe(false);
  });

  it('registers capture, lint-tick, drain (async), and session-start hooks in .claude/settings.json', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(existsSync(join(sandbox, '.claude/hooks/kk-lint-tick.cjs'))).toBe(true);
    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<
        string,
        Array<{ hooks: Array<{ type: string; command: string; async?: boolean }> }>
      >;
    };
    expect(settings.hooks).toBeDefined();
    for (const event of ['Stop', 'SessionEnd', 'PreCompact']) {
      const entries = settings.hooks?.[event];
      expect(entries, `expected hook entry for ${event}`).toBeDefined();
      expect(entries?.[0]?.hooks[0]?.command).toBe(
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-capture.cjs"'
      );
    }
    const sessionEnd = (settings.hooks?.['SessionEnd'] ?? []).flatMap(e =>
      e.hooks.map(h => h.command)
    );
    expect(sessionEnd).toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-lint-tick.cjs"');

    const sessionStart = settings.hooks?.['SessionStart'];
    expect(sessionStart).toHaveLength(2);
    const startCommands = sessionStart?.flatMap(e =>
      e.hooks.map(h => ({ command: h.command, async: h.async }))
    );
    expect(startCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-proposal-drain.cjs"',
          async: true,
        }),
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-session-start.cjs"',
        }),
      ])
    );
  });

  it('emitted Stop hook command loads when invoked from a subdirectory CWD', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const stopCommand = settings.hooks?.['Stop']?.[0]?.hooks[0]?.command;
    expect(stopCommand).toBeDefined();

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
      readFileSync(join(sandbox, '.ai/kenkeep/config.yaml'), 'utf8')
    ) as Record<string, unknown>;
    expect(body['schema_version']).toBe(1);
    expect(body['curationThreshold']).toBe(20);
    expect(body['logsRetentionDays']).toBe(30);
    expect(body['lintEveryNSessions']).toBe(50);
    expect(Object.keys(body).sort()).toEqual([
      'curationThreshold',
      'lintEveryNSessions',
      'logsRetentionDays',
      'schema_version',
    ]);
  });

  it('writes a default .kkignore on fresh init when absent', async () => {
    const kkignore = join(sandbox, '.kkignore');
    expect(existsSync(kkignore)).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(kkignore)).toBe(true);

    const body = readFileSync(kkignore, 'utf8');
    // Header / always-on documentation.
    expect(body).toContain('.kkignore');
    expect(body).toContain('STATIC_SKIPS');
    // Worked example covers directory deny, `!` re-include, and the
    // parent-directory caveat.
    expect(body).toContain('!docs/internal/');
    expect(body).toContain('!docs/internal/AGENTS.md');
    expect(body).toMatch(/parent-directory|every ancestor/i);
    // Glob deny example.
    expect(body).toContain('**/*.generated.md');
    // Commented-out common-noise block.
    expect(body).toContain('# build/');
    expect(body).toContain('# dist/');
    expect(body).toContain('# coverage/');
    // Uncommented harness instruction deny block — at least the Claude
    // directories that were installed for this init.
    expect(body).toContain('.claude/skills/');
    expect(body).toContain('.claude/commands/');
    expect(body).toContain('.claude/hooks/');
  });

  it('injects the kk index pointer block into an existing AGENTS.md and never duplicates it on upgrade', async () => {
    writeFileSync(join(sandbox, 'AGENTS.md'), '# My Project\n\nSome description.\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const first = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    expect(first).toContain('# My Project');
    // The full delimited block is injected: open marker, INDEX pointer, close marker.
    expect(first).toContain('<!-- >>> kenkeep:kk-index >>> -->');
    expect(first).toContain('.ai/kenkeep/INDEX.md');
    expect(first).toContain('<!-- <<< kenkeep:kk-index <<< -->');

    // Upgrade should not duplicate the block.
    await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    const second = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    const occurrences = second.match(/<!-- >>> kenkeep:kk-index >>> -->/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(second).toContain('# My Project');
  });

  it('does not overwrite an existing .kkignore on --upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const kkignore = join(sandbox, '.kkignore');
    const customized = '# customized by user\nfoo/\n';
    writeFileSync(kkignore, customized);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(kkignore, 'utf8')).toBe(customized);
  });
});
