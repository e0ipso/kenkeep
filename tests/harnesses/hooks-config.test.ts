import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeClaudeHookConfig } from '../../src/harnesses/claude/hooks-config.js';
import { writeCodexHooks } from '../../src/harnesses/codex/hooks-config.js';
import { writeCursorHooksConfig } from '../../src/harnesses/cursor/hooks-config.js';
import {
  SENTINEL_END,
  SENTINEL_START,
  writeCopilotHookConfig,
  writeCopilotInstructionsSentinel,
} from '../../src/harnesses/copilot/hooks-config.js';
import type { HarnessPaths } from '../../src/harnesses/types.js';

function copilotPaths(root: string, home: string): HarnessPaths {
  return {
    dir: join(root, '.copilot'),
    hooksDir: join(root, '.copilot', 'hooks'),
    skillsDir: join(root, '.github', 'skills'),
    settingsFile: join(home, 'hooks', 'kk.json'),
  };
}

/**
 * Per-adapter hook registration adapters. Each `register` writes the kk
 * capture hook into the harness's native config and `readCommands` reads
 * every command string back out, so the parametrized round-trip below can
 * assert "what we registered is what the host will run" without caring
 * about each config format's nesting.
 */
interface HooksRoundTrip {
  id: string;
  register(root: string, home: string): Promise<void>;
  readCommands(root: string, home: string): string[];
  expected: string;
}

function flattenClaudeStyle(parsed: {
  hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
}): string[] {
  return Object.values(parsed.hooks ?? {}).flatMap(entries =>
    entries.flatMap(e => e.hooks.map(h => h.command))
  );
}

const roundTrips: HooksRoundTrip[] = [
  {
    id: 'claude',
    register: async root =>
      writeClaudeHookConfig(root, [{ event: 'Stop', scriptPath: '.claude/hooks/kk-capture.cjs' }]),
    readCommands: root =>
      flattenClaudeStyle(JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'))),
    expected: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-capture.cjs"',
  },
  {
    id: 'codex',
    register: async root =>
      writeCodexHooks(root, [{ event: 'Stop', scriptPath: '.codex/hooks/kk-capture.cjs' }]),
    readCommands: root =>
      flattenClaudeStyle(JSON.parse(readFileSync(join(root, '.codex/hooks.json'), 'utf8'))),
    expected: 'node ./.codex/hooks/kk-capture.cjs',
  },
  {
    id: 'cursor',
    register: async root =>
      writeCursorHooksConfig(root, [{ event: 'stop', scriptPath: '.cursor/hooks/kk-capture.cjs' }]),
    readCommands: root => {
      const parsed = JSON.parse(readFileSync(join(root, '.cursor/hooks.json'), 'utf8')) as {
        hooks: Record<string, Array<{ command: string }>>;
      };
      return Object.values(parsed.hooks).flatMap(entries => entries.map(e => e.command));
    },
    expected: 'node ./.cursor/hooks/kk-capture.cjs',
  },
  {
    id: 'copilot',
    register: async (root, home) => writeCopilotHookConfig(copilotPaths(root, home)),
    readCommands: (root, home) => {
      const parsed = JSON.parse(readFileSync(join(home, 'hooks', 'kk.json'), 'utf8')) as {
        hooks: Record<string, Array<{ bash: string }>>;
      };
      return Object.values(parsed.hooks).flatMap(entries => entries.map(e => e.bash));
    },
    expected: 'kk-capture.cjs',
  },
];

describe('hook registration round-trip (parametrized over registered harnesses)', () => {
  let root: string;
  let home: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-hooks-roundtrip-'));
    home = mkdtempSync(join(tmpdir(), 'kk-hooks-home-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it.each(roundTrips)(
    '$id registers the kk capture hook and is idempotent across a rewrite',
    async ({ register, readCommands, expected }) => {
      await register(root, home);
      const commands = readCommands(root, home);
      expect(commands.some(c => c.includes(expected))).toBe(true);
      const first = JSON.stringify(commands);
      await register(root, home);
      expect(JSON.stringify(readCommands(root, home))).toBe(first);
    }
  );
});

describe('writeClaudeHookConfig (Claude settings.json specifics)', () => {
  let root: string;
  let settingsFile: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-hooks-config-'));
    settingsFile = join(root, '.claude/settings.json');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('treats an empty settings.json as an empty object and writes the canonical command', async () => {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(settingsFile, '{}');
    await writeClaudeHookConfig(root, [
      { event: 'SessionEnd', scriptPath: '.claude/hooks/kk-capture.cjs' },
    ]);
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    expect(parsed.hooks.SessionEnd[0].hooks[0].command).toBe(
      'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-capture.cjs"'
    );
  });

  it('preserves foreign hooks and scrubs previously-owned kk- hooks before rewriting', async () => {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(
      settingsFile,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-old-name.mjs"',
                },
              ],
            },
            { hooks: [{ type: 'command', command: 'node ./scripts/user-stop.mjs' }] },
          ],
        },
      })
    );

    await writeClaudeHookConfig(root, [{ event: 'Stop', scriptPath: '.claude/hooks/kk-capture.cjs' }]);

    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const commands = parsed.hooks.Stop.flatMap((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.map(h => h.command)
    );
    expect(commands).not.toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-old-name.mjs"');
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kk-capture.cjs"');
  });

  it('emits async: true only when the spec sets it and preserves matcher when set', async () => {
    await writeClaudeHookConfig(root, [
      { event: 'SessionStart', scriptPath: '.claude/hooks/kk-session-start.cjs' },
      { event: 'SessionStart', scriptPath: '.claude/hooks/kk-proposal-drain.cjs', async: true },
      { event: 'UserPromptSubmit', scriptPath: '.claude/hooks/kk-filter.cjs', matcher: '**/*.md' },
    ]);
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const sessionEntries = parsed.hooks.SessionStart as Array<{
      hooks: Array<{ command: string; async?: boolean }>;
    }>;
    const sessionStart = sessionEntries
      .flatMap(e => e.hooks)
      .find(h => h.command.includes('kk-session-start.cjs'));
    const drain = sessionEntries
      .flatMap(e => e.hooks)
      .find(h => h.command.includes('kk-proposal-drain.cjs'));
    expect(Object.prototype.hasOwnProperty.call(sessionStart, 'async')).toBe(false);
    expect(drain!.async).toBe(true);
    expect(parsed.hooks.UserPromptSubmit[0].matcher).toBe('**/*.md');
  });
});

describe('writeCodexHooks (Codex hooks.json specifics)', () => {
  let root: string;
  let hooksFile: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-codex-hooks-'));
    hooksFile = join(root, '.codex/hooks.json');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the canonical multi-event shape, including async drain entries', async () => {
    await writeCodexHooks(root, [
      { event: 'Stop', scriptPath: '.codex/hooks/kk-capture.cjs' },
      { event: 'SessionStart', scriptPath: '.codex/hooks/kk-session-start.cjs' },
      { event: 'SessionStart', scriptPath: '.codex/hooks/kk-proposal-drain.cjs', async: true },
    ]);
    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    expect(parsed.hooks.Stop[0].hooks[0]).toEqual({
      type: 'command',
      command: 'node ./.codex/hooks/kk-capture.cjs',
      timeout: 30,
    });
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    expect(parsed.hooks.SessionStart[1].hooks[0].command).toBe(
      'node ./.codex/hooks/kk-proposal-drain.cjs'
    );
  });

  it('refuses to write when .codex/config.toml defines a [hooks] table', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(
      join(root, '.codex/config.toml'),
      ['[hooks]', '', '[[hooks.Stop]]', 'command = "echo hi"', ''].join('\n')
    );
    let caught: Error | null = null;
    try {
      await writeCodexHooks(root, [{ event: 'Stop', scriptPath: '.codex/hooks/kk-capture.cjs' }]);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Refusing to write .codex/hooks.json');
    expect(caught!.message).toContain('.codex/config.toml already defines [hooks]');
    expect(caught!.message).toContain(
      'https://github.com/e0ipso/kenkeep/blob/main/docs/installation/codex-toml-hooks-coexistence.md'
    );
  });

});

describe('writeCursorHooksConfig (Cursor hooks.json specifics)', () => {
  let root: string;
  let hooksFile: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-cursor-hooks-'));
    hooksFile = join(root, '.cursor/hooks.json');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the native Cursor shape with version and flat command entries', async () => {
    await writeCursorHooksConfig(root, [
      { event: 'stop', scriptPath: '.cursor/hooks/kk-capture.cjs' },
      { event: 'sessionStart', scriptPath: '.cursor/hooks/kk-session-start.cjs' },
    ]);
    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.stop).toEqual([
      { command: 'node ./.cursor/hooks/kk-capture.cjs', timeout: 30 },
    ]);
    expect(parsed.hooks.sessionStart[0].command).toBe('node ./.cursor/hooks/kk-session-start.cjs');
  });
});

describe('writeCopilotHookConfig and sentinel (Copilot specifics)', () => {
  let root: string;
  let home: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-copilot-cfg-'));
    home = mkdtempSync(join(tmpdir(), 'kk-copilot-home-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('writes a deterministic { version, hooks } document to both files byte-for-byte', async () => {
    const paths = copilotPaths(root, home);
    await writeCopilotHookConfig(paths);

    const projectFile = join(root, '.copilot', 'hooks', 'kk.json');
    const userFile = join(home, 'hooks', 'kk.json');
    expect(readFileSync(projectFile, 'utf8')).toBe(readFileSync(userFile, 'utf8'));

    const parsed = JSON.parse(readFileSync(userFile, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.hooks).sort()).toEqual(['agentStop', 'sessionEnd', 'sessionStart']);

    const kkHooksDir = join(root, '.copilot', 'kk-hooks');
    for (const entries of Object.values(parsed.hooks) as Array<
      Array<{ type: string; bash: string; timeoutSec: number; env: Record<string, string> }>
    >) {
      for (const entry of entries) {
        expect(entry.type).toBe('command');
        expect(entry.bash.startsWith(`node ${kkHooksDir}`)).toBe(true);
        expect(entry.timeoutSec).toBe(30);
        expect(entry.env.KENKEEP_BUILDER_INTERNAL).toBe('1');
      }
    }
    expect(parsed.hooks.sessionStart).toHaveLength(2);
    expect(parsed.hooks.sessionEnd).toHaveLength(2);
    expect(parsed.hooks.agentStop).toHaveLength(1);
  });

  it('appends a sentinel block, preserves user content, and is zero-diff on re-run', async () => {
    mkdirSync(join(root, '.ai', 'kenkeep'), { recursive: true });
    writeFileSync(
      join(root, '.ai', 'kenkeep', 'ENTRY.md'),
      '# Knowledge base index\n\n_0 nodes_\n'
    );
    const instructionsFile = join(root, '.github', 'copilot-instructions.md');
    mkdirSync(join(root, '.github'), { recursive: true });
    writeFileSync(instructionsFile, 'USER CONTENT HERE\n');

    await writeCopilotInstructionsSentinel(copilotPaths(root, home));
    const first = readFileSync(instructionsFile, 'utf8');
    expect(first).toContain('USER CONTENT HERE');
    expect(first).toContain(SENTINEL_START);
    expect(first).toContain(SENTINEL_END);
    expect(first).toContain('Knowledge base index');
    expect(first.split(SENTINEL_START)).toHaveLength(2);

    await writeCopilotInstructionsSentinel(copilotPaths(root, home));
    const second = readFileSync(instructionsFile, 'utf8');
    expect(second).toBe(first);
    expect(second.split(SENTINEL_START)).toHaveLength(2);
  });
});
