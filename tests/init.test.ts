import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from './helpers.js';

const exec = promisify(execFile);

async function commitAll(cwd: string, message: string): Promise<void> {
  await exec('git', ['add', '-A'], { cwd });
  await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message], {
    cwd,
  });
}

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
      '.ai/kenkeep/ENTRY.md',
      '.ai/kenkeep/GRAPH.md',
      '.ai/kenkeep/nodes/index.md',
      '.ai/kenkeep/_sessions/.gitkeep',
      '.ai/kenkeep/_logs/proposal/.gitkeep',
      '.ai/kenkeep/_logs/curator/.gitkeep',
      '.ai/kenkeep/_logs/bootstrap/.gitkeep',
      '.claude/settings.json',
      '.claude/skills/kk-add/SKILL.md',
      '.claude/skills/kk-bootstrap/SKILL.md',
      '.claude/skills/kk-curate/SKILL.md',
      '.claude/skills/kk-migrate/SKILL.md',
      '.claude/skills/kk-session-extract/SKILL.md',
      '.ai/kenkeep/hooks/claude/kk-capture.cjs',
      '.ai/kenkeep/hooks/claude/kk-proposal-drain.cjs',
      '.ai/kenkeep/hooks/claude/kk-session-start.cjs',
      '.ai/kenkeep/.state/installed-version',
      '.ai/kenkeep/.config/prompts/proposal-extract.md',
      '.ai/kenkeep/.config/prompts/knowledge-admission.md',
      '.ai/kenkeep/.config/prompts/sub-agent-delegation.md',
      '.ai/kenkeep/config.yaml',
      '.ai/kenkeep/.gitignore',
      '.ai/kenkeep/scripts/kk-detect-root.mjs',
      '.ai/kenkeep/assets/notification-icon.png',
    ];

    for (const rel of expected) {
      expect(existsSync(join(sandbox, rel)), `expected ${rel}`).toBe(true);
    }

    // _proposed/ must not be created — the architecture writes directly to nodes/.
    expect(existsSync(join(sandbox, '.ai/kenkeep/_proposed'))).toBe(false);
  });

  it('installs skills that resolve the root via the shipped detector', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).toBe(0);

    for (const skill of ['kk-add', 'kk-bootstrap', 'kk-curate', 'kk-migrate']) {
      const body = readFileSync(join(sandbox, `.claude/skills/${skill}/SKILL.md`), 'utf8');
      expect(body).toContain('node .ai/kenkeep/scripts/kk-detect-root.mjs');
      expect(body).toContain('cd "$KK_REPO_ROOT"');
      // The vestigial harness resolution (only ever fed an ignored index-rebuild
      // flag) is gone from the skill bodies.
      expect(body).not.toContain('/tmp/kk-detect-root.mjs');
      expect(body).not.toContain('kk-detect-harness.mjs');
    }
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

  it('points to the kk-migrate skill when an existing knowledge base is at an older schema_version', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    // Plant a legacy flat-layout (schema_version 1) leaf so the detector sees a stale KB.
    const bucket = join(sandbox, '.ai/kenkeep/nodes/practice');
    mkdirSync(bucket, { recursive: true });
    writeFileSync(
      join(bucket, 'practice-old.md'),
      '---\nschema_version: 1\nid: practice-old\n---\n\n# old\n'
    );

    // Re-running init (already-initialized path) surfaces the migrate guidance,
    // which names the in-session kk-migrate skill.
    const reinit = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(reinit.exitCode).toBe(0);
    const reinitOut = reinit.stdout + reinit.stderr;
    expect(reinitOut).toMatch(/schema_version 1/);
    expect(reinitOut).toMatch(/`\/kk-migrate` skill/);
    expect(reinitOut).not.toMatch(/npx kenkeep --harness <id> migrate/);

    // The upgrade path surfaces it too.
    const upgrade = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(upgrade.exitCode).toBe(0);
    expect(upgrade.stdout + upgrade.stderr).toMatch(/`\/kk-migrate` skill/);
  });

  it('does not mention migration when the knowledge base is already at the current schema', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const reinit = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(reinit.stdout + reinit.stderr).not.toMatch(/kk-migrate/);
    expect(reinit.stdout + reinit.stderr).not.toMatch(/migrate it/);
  });

  it('writes .ai/kenkeep/.gitignore and leaves the project .gitignore untouched', async () => {
    const projectGitignore = join(sandbox, '.gitignore');
    writeFileSync(projectGitignore, 'node_modules\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const kkGitignore = join(sandbox, '.ai/kenkeep/.gitignore');
    const kkBody = readFileSync(kkGitignore, 'utf8');
    expect(kkBody).toContain('_sessions/');
    expect(kkBody).toContain('_logs/');
    expect(kkBody).toContain('hooks/');
    expect(kkBody).toContain('.state/*');
    expect(kkBody).toContain('!.state/installed-version');

    const projectBody = readFileSync(projectGitignore, 'utf8');
    expect(projectBody).toBe('node_modules\n');
    expect(projectBody).not.toContain('kenkeep');
  });

  it('lets `git add .ai/kenkeep/` stage .state/installed-version', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);

    const { stdout } = await exec('git', ['status', '--short', '--untracked-files=all'], {
      cwd: sandbox,
    });
    // Pre-condition: installed-version is untracked before the add.
    expect(stdout).toContain('.ai/kenkeep/.state/installed-version');

    await exec('git', ['add', '.ai/kenkeep/'], { cwd: sandbox });

    const { stdout: after } = await exec('git', ['diff', '--cached', '--name-only'], {
      cwd: sandbox,
    });
    expect(after).toContain('.ai/kenkeep/.state/installed-version');
  });

  it('refuses to overwrite when already initialized', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const second = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(second.exitCode).toBe(0);
    expect(second.stdout + second.stderr).toContain('Already initialized');
  });

  // The documented teammate flow is "commit, clone, run init". The hook
  // scripts the committed host configs point at are gitignored, so init on an
  // initialized clone must restore them for every recorded harness (not only
  // the one named on the command line) while leaving committed, user-edited
  // files byte-identical.
  it('restores gitignored runtime assets on a fresh clone without touching user config or overrides', async () => {
    const stubBin = writeHarnessBinaryStubs(sandbox);
    const env: NodeJS.ProcessEnv = { PATH: `${stubBin}:${process.env['PATH'] ?? ''}` };
    const first = await runCli(sandbox, ['init', '--harnesses', 'claude,codex']);
    expect(first.exitCode).toBe(0);

    const configRel = '.ai/kenkeep/config.yaml';
    const promptRel = '.ai/kenkeep/.config/prompts/proposal-extract.md';
    const customConfig = 'schema_version: 1\ncurationThreshold: 7\n';
    writeFileSync(join(sandbox, configRel), customConfig);
    const customPrompt = `${readFileSync(join(sandbox, promptRel), 'utf8')}\n<!-- team override -->\n`;
    writeFileSync(join(sandbox, promptRel), customPrompt);
    await commitAll(sandbox, 'init kenkeep');

    const clone = join(sandbox, 'clone');
    await exec('git', ['clone', '-q', sandbox, clone]);
    // Precondition: the committed host configs reference scripts the clone lacks.
    expect(existsSync(join(clone, '.claude/settings.json'))).toBe(true);
    expect(existsSync(join(clone, '.codex/hooks.json'))).toBe(true);
    expect(existsSync(join(clone, '.ai/kenkeep/hooks'))).toBe(false);

    const repair = await runCli(clone, ['init', '--harnesses', 'claude']);
    expect(repair.exitCode).toBe(0);
    for (const rel of [
      '.ai/kenkeep/hooks/claude/kk-capture.cjs',
      '.ai/kenkeep/hooks/claude/kk-session-start.cjs',
      '.ai/kenkeep/hooks/codex/kk-capture.cjs',
      '.ai/kenkeep/hooks/codex/kk-session-start.cjs',
    ]) {
      expect(existsSync(join(clone, rel)), `expected ${rel}`).toBe(true);
    }
    expect(readFileSync(join(clone, configRel), 'utf8')).toBe(customConfig);
    expect(readFileSync(join(clone, promptRel), 'utf8')).toBe(customPrompt);
    // The inventory and every other tracked file are left alone.
    const { stdout: status } = await exec('git', ['status', '--porcelain'], { cwd: clone });
    expect(status.trim()).toBe('');

    const doctor = await runCli(clone, ['doctor'], env);
    expect(doctor.exitCode, doctor.stdout + doctor.stderr).toBe(0);
  });

  // A repair lands only the scripts that are missing. The ones already
  // on disk stay byte-identical (PRD 9.1, docs/installation.md); replacing
  // the whole set is `init --upgrade`'s job.
  it('restores only the missing hook scripts and leaves the present ones byte-identical', async () => {
    const first = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(first.exitCode).toBe(0);
    const hooksDir = join(sandbox, '.ai/kenkeep/hooks/claude');
    const capture = join(hooksDir, 'kk-capture.cjs');
    const edited = `${readFileSync(capture, 'utf8')}\n// locally patched\n`;
    writeFileSync(capture, edited);
    rmSync(join(hooksDir, 'kk-session-start.cjs'));

    const repair = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(repair.exitCode).toBe(0);
    expect(existsSync(join(hooksDir, 'kk-session-start.cjs'))).toBe(true);
    expect(readFileSync(capture, 'utf8')).toBe(edited);
    const output = repair.stdout + repair.stderr;
    expect(output).toContain('Restored 1 hook script for claude:');
    expect(output).toContain('kk-session-start.cjs');
    expect(output).not.toContain('kk-capture.cjs');
  });

  it('installs a newly requested harness into an initialized repo and merges the inventory', async () => {
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const claudeSettings = readFileSync(join(sandbox, '.claude/settings.json'), 'utf8');

    const result = await runCli(sandbox, ['init', '--harnesses', 'cursor']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(sandbox, '.cursor/hooks.json'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/cursor/kk-capture.cjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.cursor/skills/kk-curate/SKILL.md'))).toBe(true);
    const installed = JSON.parse(
      readFileSync(join(sandbox, '.ai/kenkeep/.state/installed-version'), 'utf8')
    ) as { harnesses: string[] };
    expect(installed.harnesses).toEqual(['claude', 'cursor']);
    expect(readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')).toBe(claudeSettings);
  });

  it('fails without an install marker when a selected harness config is malformed', async () => {
    mkdirSync(join(sandbox, '.codex'), { recursive: true });
    writeFileSync(join(sandbox, '.codex/hooks.json'), '{"hooks": 5}\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude,codex']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('.codex/hooks.json');
    // The writer refused the file untouched and the run recorded nothing, so
    // a re-run after the fix is a fresh install.
    expect(readFileSync(join(sandbox, '.codex/hooks.json'), 'utf8')).toBe('{"hooks": 5}\n');
    expect(existsSync(join(sandbox, '.ai/kenkeep/.state/installed-version'))).toBe(false);
  });

  it('refuses an unparseable OpenCode config without installing the adapter', async () => {
    mkdirSync(join(sandbox, '.opencode'), { recursive: true });
    const configFile = join(sandbox, '.opencode/opencode.json');
    writeFileSync(configFile, '{broken\n');

    const result = await runCli(sandbox, ['init', '--harnesses', 'opencode']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('.opencode/opencode.json');
    expect(readFileSync(configFile, 'utf8')).toBe('{broken\n');
    expect(existsSync(join(sandbox, '.opencode/plugins/kk.mjs'))).toBe(false);
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/opencode'))).toBe(false);
    expect(existsSync(join(sandbox, '.ai/kenkeep/.state/installed-version'))).toBe(false);
  });

  it('refuses an OpenCode config whose plugin or instructions entry is not an array', async () => {
    mkdirSync(join(sandbox, '.opencode'), { recursive: true });
    const configFile = join(sandbox, '.opencode/opencode.json');
    const original = '{"plugin":"user-plugin","instructions":"user-instructions"}\n';
    writeFileSync(configFile, original);

    const result = await runCli(sandbox, ['init', '--harnesses', 'opencode']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/opencode\.json[^\n]*"plugin"/);
    expect(readFileSync(configFile, 'utf8')).toBe(original);
    expect(existsSync(join(sandbox, '.opencode/plugins/kk.mjs'))).toBe(false);
    expect(existsSync(join(sandbox, '.ai/kenkeep/.state/installed-version'))).toBe(false);
  });

  it('tells Copilot users to commit the .github/ artifacts it actually wrote', async () => {
    const result = await runCli(sandbox, ['init', '--harnesses', 'copilot'], {
      COPILOT_HOME: join(sandbox, 'copilot-home'),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('`.github/`');
    expect(result.stdout).not.toContain('.copilot/');
    expect(existsSync(join(sandbox, '.copilot'))).toBe(false);
    expect(existsSync(join(sandbox, '.github/hooks/kk.json'))).toBe(true);
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
    expect(claudeSkill).toContain('node .ai/kenkeep/scripts/kk-detect-root.mjs');
    expect(existsSync(join(sandbox, '.opencode/plugins/kk.mjs'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/opencode/kk-capture.cjs'))).toBe(true);
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
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/claude/kk-lint-tick.cjs'))).toBe(true);
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
        'node "$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-capture.cjs"'
      );
    }
    const sessionEnd = (settings.hooks?.['SessionEnd'] ?? []).flatMap(e =>
      e.hooks.map(h => h.command)
    );
    expect(sessionEnd).toContain(
      'node "$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-lint-tick.cjs"'
    );

    const sessionStart = settings.hooks?.['SessionStart'];
    expect(sessionStart).toHaveLength(2);
    const startCommands = sessionStart?.flatMap(e =>
      e.hooks.map(h => ({ command: h.command, async: h.async }))
    );
    expect(startCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-proposal-drain.cjs"',
          async: true,
        }),
        expect.objectContaining({
          command: 'node "$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-session-start.cjs"',
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
    expect(body['notifications']).toEqual({ enabled: true, backends: {} });
    expect(Object.keys(body).sort()).toEqual([
      'curationThreshold',
      'lintEveryNSessions',
      'logsRetentionDays',
      'notifications',
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
    // Uncommented Strikethroo deny.
    expect(body).toContain('.ai/strikethroo/');
    // Uncommented harness instruction deny block — at least the Claude
    // directories that were installed for this init.
    expect(body).toContain('.claude/skills/');
    expect(body).toContain('.claude/commands/');
    expect(body).toContain('.ai/kenkeep/hooks/');
  });

  it('injects the kk index pointer block into an existing AGENTS.md and never duplicates it on upgrade', async () => {
    writeFileSync(join(sandbox, 'AGENTS.md'), '# My Project\n\nSome description.\n');

    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    const first = readFileSync(join(sandbox, 'AGENTS.md'), 'utf8');
    expect(first).toContain('# My Project');
    // The full delimited block is injected: open marker, ENTRY pointer, close marker.
    expect(first).toContain('<!-- >>> kenkeep:kk-index >>> -->');
    expect(first).toContain('.ai/kenkeep/ENTRY.md');
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
