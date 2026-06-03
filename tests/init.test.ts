import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      '.claude/hooks/kb-capture.cjs',
      '.claude/hooks/kb-proposal-drain.cjs',
      '.claude/hooks/kb-session-start.cjs',
      '.ai/knowledge-base/.state/installed-version',
      '.ai/knowledge-base/.config/prompts/proposal-extract.md',
      '.ai/knowledge-base/config.yaml',
      '.ai/knowledge-base/.gitignore',
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

  it('writes .ai/knowledge-base/.gitignore and leaves the project .gitignore untouched', async () => {
    const projectGitignore = join(sandbox, '.gitignore');
    writeFileSync(projectGitignore, 'node_modules\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const kbGitignore = join(sandbox, '.ai/knowledge-base/.gitignore');
    const kbBody = readFileSync(kbGitignore, 'utf8');
    expect(kbBody).toContain('_sessions/');
    expect(kbBody).toContain('_logs/');
    expect(kbBody).toContain('.state/');
    expect(kbBody).toContain('!.state/installed-version');

    const projectBody = readFileSync(projectGitignore, 'utf8');
    expect(projectBody).toBe('node_modules\n');
    expect(projectBody).not.toContain('@e0ipso/ai-knowledge-base');
  });

  it('preserves a user-edited .ai/knowledge-base/.gitignore across --upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const kbGitignore = join(sandbox, '.ai/knowledge-base/.gitignore');
    writeFileSync(kbGitignore, '# user edited\nscratch/\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    expect(readFileSync(kbGitignore, 'utf8')).toBe('# user edited\nscratch/\n');
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

  it('installs cursor hooks and skills on init --harnesses cursor', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'cursor']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(sandbox, '.cursor/hooks.json'))).toBe(true);
    expect(existsSync(join(sandbox, '.cursor/hooks/kb-capture.cjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.cursor/hooks/kb-session-start.cjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.cursor/hooks/kb-proposal-drain.cjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.cursor/hooks/kb-lint-tick.cjs'))).toBe(true);
    const skill = readFileSync(join(sandbox, '.cursor/skills/kb-curate/SKILL.md'), 'utf8');
    expect(skill).toContain("'cursor'");
    const hooks = JSON.parse(readFileSync(join(sandbox, '.cursor/hooks.json'), 'utf8'));
    expect(hooks.hooks.stop.some((e: { command: string }) => e.command.includes('kb-capture'))).toBe(
      true
    );
  });

  it('installs the shared skill bytes identically across all four harnesses', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude,codex,cursor,opencode']);
    expect(result.exitCode).toBe(0);
    const claudeSkill = readFileSync(join(sandbox, '.claude/skills/kb-curate/SKILL.md'), 'utf8');
    const codexSkill = readFileSync(join(sandbox, '.agents/skills/kb-curate/SKILL.md'), 'utf8');
    const cursorSkill = readFileSync(join(sandbox, '.cursor/skills/kb-curate/SKILL.md'), 'utf8');
    const openCodeSkill = readFileSync(
      join(sandbox, '.opencode/skills/kb-curate/SKILL.md'),
      'utf8'
    );
    expect(claudeSkill).toBe(codexSkill);
    expect(codexSkill).toBe(cursorSkill);
    expect(cursorSkill).toBe(openCodeSkill);
    expect(claudeSkill).toContain('/tmp/kb-detect-harness.mjs');
    expect(existsSync(join(sandbox, '.opencode/plugins/kb.mjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.opencode/kb-hooks/kb-capture.cjs'))).toBe(true);
  });

  it('installs the shared skill bytes identically across claude, codex, and opencode', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude,codex,opencode']);
    expect(result.exitCode).toBe(0);
    const claudeSkill = readFileSync(join(sandbox, '.claude/skills/kb-curate/SKILL.md'), 'utf8');
    const codexSkill = readFileSync(join(sandbox, '.agents/skills/kb-curate/SKILL.md'), 'utf8');
    const openCodeSkill = readFileSync(
      join(sandbox, '.opencode/skills/kb-curate/SKILL.md'),
      'utf8'
    );
    expect(claudeSkill).toBe(codexSkill);
    expect(codexSkill).toBe(openCodeSkill);
    expect(claudeSkill).toContain('/tmp/kb-detect-harness.mjs');
    expect(existsSync(join(sandbox, '.opencode/plugins/kb.mjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.opencode/kb-hooks/kb-capture.cjs'))).toBe(true);
  });

  it('succeeds in a repo without a package.json and produces no husky artefacts', async () => {
    expect(existsSync(join(sandbox, 'package.json'))).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(sandbox, '.ai/knowledge-base'))).toBe(true);
    expect(existsSync(join(sandbox, '.claude'))).toBe(true);

    expect(existsSync(join(sandbox, '.husky'))).toBe(false);
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
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"'
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
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-proposal-drain.cjs"',
          async: true,
        }),
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-session-start.cjs"',
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

  it('registers both SessionEnd capture and lint-tick hooks and ships kb-lint-tick.cjs', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(existsSync(join(sandbox, '.claude/hooks/kb-lint-tick.cjs'))).toBe(true);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };
    const sessionEnd = settings.hooks?.['SessionEnd'] ?? [];
    const commands = sessionEnd.flatMap(e => e.hooks.map(h => h.command));
    expect(commands).toEqual(
      expect.arrayContaining([
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"',
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-lint-tick.cjs"',
      ])
    );
  });

  it('re-running init --upgrade preserves a single set of SessionEnd entries (no duplicates)', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);

    const settings = JSON.parse(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const sessionEnd = settings.hooks?.['SessionEnd'] ?? [];
    const commands = sessionEnd.flatMap(e => e.hooks.map(h => h.command));
    const captureCount = commands.filter(
      c => c === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"'
    ).length;
    const lintCount = commands.filter(
      c => c === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-lint-tick.cjs"'
    ).length;
    expect(captureCount).toBe(1);
    expect(lintCount).toBe(1);
  });

  it('does not overwrite an existing config.yaml on --upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const configFile = join(sandbox, '.ai/knowledge-base/config.yaml');
    const customized = 'schema_version: 1\ncurationThreshold: 99\n';
    writeFileSync(configFile, customized);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(configFile, 'utf8')).toBe(customized);
  });

  it('writes a default .kbignore on fresh init when absent', async () => {
    const kbignore = join(sandbox, '.kbignore');
    expect(existsSync(kbignore)).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(kbignore)).toBe(true);

    const body = readFileSync(kbignore, 'utf8');
    // Header / always-on documentation.
    expect(body).toContain('.kbignore');
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

  it('leaves an existing .kbignore untouched on fresh init', async () => {
    // Pre-existing .kbignore counts as initialization-prereq state; an
    // un-initialized repo with a user-authored .kbignore must keep it
    // verbatim after `init` runs.
    const kbignore = join(sandbox, '.kbignore');
    const customBody = '# user-authored\nfoo/bar/**\n';
    writeFileSync(kbignore, customBody);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(kbignore, 'utf8')).toBe(customBody);
  });

  it('writes .kbignore on init --upgrade when absent', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const kbignore = join(sandbox, '.kbignore');
    // Simulate a pre-existing install that predates `.kbignore` emission.
    rmSync(kbignore);
    expect(existsSync(kbignore)).toBe(false);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(kbignore)).toBe(true);
    expect(readFileSync(kbignore, 'utf8')).toContain('.claude/skills/');
  });

  it('injects KB index pointer into AGENTS.md on fresh init', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    const agents = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('<!-- >>> @e0ipso/ai-knowledge-base:kb-index >>> -->');
    expect(agents).toContain('.ai/knowledge-base/INDEX.md');
    expect(agents).toContain('<!-- <<< @e0ipso/ai-knowledge-base:kb-index <<< -->');
  });

  it('appends KB index pointer to an existing AGENTS.md without duplicating', async () => {
    writeFileSync(join(sandbox, 'AGENTS.md'), '# My Project\n\nSome description.\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const first = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    expect(first).toContain('# My Project');
    expect(first).toContain('.ai/knowledge-base/INDEX.md');

    // Upgrade should not duplicate the block.
    await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    const second = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    const occurrences =
      second.match(/<!-- >>> @e0ipso\/ai-knowledge-base:kb-index >>> -->/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(second).toContain('# My Project');
  });

  it('does not accumulate extra newlines in AGENTS.md on repeated upgrades', async () => {
    writeFileSync(join(sandbox, 'AGENTS.md'), '# Project\n');
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const first = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');

    for (let i = 0; i < 5; i++) {
      await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    }
    const after = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    expect(after).toBe(first);
  });

  it('does not overwrite an existing .kbignore on --upgrade', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const kbignore = join(sandbox, '.kbignore');
    const customized = '# customized by user\nfoo/\n';
    writeFileSync(kbignore, customized);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(kbignore, 'utf8')).toBe(customized);
  });

  it('.kbignore deny block enumerates every registered harness adapter when installed together', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude,codex,cursor,opencode']);
    expect(result.exitCode).toBe(0);
    const body = readFileSync(join(sandbox, '.kbignore'), 'utf8');
    // Claude.
    expect(body).toContain('.claude/skills/');
    expect(body).toContain('.claude/commands/');
    expect(body).toContain('.claude/hooks/');
    // Codex.
    expect(body).toContain('.agents/skills/');
    expect(body).toContain('.codex/hooks/');
    // Cursor.
    expect(body).toContain('.cursor/skills/');
    expect(body).toContain('.cursor/hooks/');
    // OpenCode.
    expect(body).toContain('.opencode/skills/');
    expect(body).toContain('.opencode/plugins/');
  });
});
