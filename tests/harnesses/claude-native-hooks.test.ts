import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

/**
 * A21: Claude settings legitimately carry non-command hook handlers
 * (`prompt`, `agent`, `http`). kenkeep's registration must leave them exactly
 * as the user wrote them across init and upgrade, and must reject a malformed
 * hooks array deliberately instead of crashing midway through a write.
 */
const USER_STOP_GROUPS = [
  {
    hooks: [
      { type: 'prompt', prompt: 'Is the task complete? $ARGUMENTS', timeout: 30 },
      { type: 'agent', prompt: 'Verify the tests pass before stopping.', model: 'haiku' },
    ],
  },
  {
    matcher: '',
    hooks: [
      {
        type: 'http',
        url: 'http://127.0.0.1:8080/hooks/stop',
        headers: { Authorization: 'Bearer $MY_TOKEN' },
        allowedEnvVars: ['MY_TOKEN'],
      },
    ],
  },
  { hooks: [{ type: 'command', command: 'node ./scripts/user-stop.mjs' }] },
];

const USER_PRE_TOOL = [
  {
    matcher: 'Bash',
    hooks: [{ type: 'prompt', prompt: 'Is this command safe? $ARGUMENTS' }],
    userExtraKey: { keep: true },
  },
];

interface Group {
  matcher?: string;
  hooks: Array<{ type: string; command?: string }>;
}

function kkCommands(groups: Group[]): string[] {
  return groups
    .flatMap(g => g.hooks)
    .filter(h => h.type === 'command' && typeof h.command === 'string')
    .map(h => h.command as string)
    .filter(c => c.includes('.ai/kenkeep/hooks/claude/kk-'));
}

describe('Claude init with native non-command hooks', () => {
  let sandbox: string;
  let settingsFile: string;

  beforeEach(async () => {
    sandbox = makeSandbox('ai-kk-claude-native-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    settingsFile = join(sandbox, '.claude', 'settings.json');
    mkdirSync(join(sandbox, '.claude'), { recursive: true });
  });
  afterEach(() => cleanSandbox(sandbox));

  it('preserves prompt/agent/http hooks across init and upgrade, registering kk hooks once', async () => {
    writeFileSync(
      settingsFile,
      `${JSON.stringify(
        {
          permissions: { allow: ['Bash(npm test)'] },
          hooks: { Stop: USER_STOP_GROUPS, PreToolUse: USER_PRE_TOOL },
        },
        null,
        2
      )}\n`
    );

    const first = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(first.stderr).not.toContain('Cannot read properties');
    expect(first.exitCode).toBe(0);
    const afterInit = readFileSync(settingsFile, 'utf8');

    const second = await runCli(sandbox, ['init', '--harnesses', 'claude', '--upgrade']);
    expect(second.exitCode).toBe(0);
    const afterUpgrade = readFileSync(settingsFile, 'utf8');
    // Re-registration is a fixed point.
    expect(afterUpgrade).toBe(afterInit);

    const parsed = JSON.parse(afterUpgrade) as {
      permissions: unknown;
      hooks: Record<string, Group[]>;
    };
    expect(parsed.permissions).toEqual({ allow: ['Bash(npm test)'] });
    // The user's groups survive verbatim, in order, ahead of kenkeep's own.
    expect(parsed.hooks.Stop?.slice(0, USER_STOP_GROUPS.length)).toEqual(USER_STOP_GROUPS);
    expect(parsed.hooks.PreToolUse).toEqual(USER_PRE_TOOL);

    // kenkeep's registrations match a clean install's exactly: nothing
    // duplicated by the second pass, nothing lost to the user's handlers.
    const clean = makeSandbox('ai-kk-claude-clean-');
    try {
      await exec('git', ['init', '-q'], { cwd: clean });
      expect((await runCli(clean, ['init', '--harnesses', 'claude'])).exitCode).toBe(0);
      const cleanHooks = (
        JSON.parse(readFileSync(join(clean, '.claude', 'settings.json'), 'utf8')) as {
          hooks: Record<string, Group[]>;
        }
      ).hooks;
      const events = new Set([...Object.keys(cleanHooks), ...Object.keys(parsed.hooks)]);
      for (const event of events) {
        expect(kkCommands(parsed.hooks[event] ?? []), event).toEqual(
          kkCommands(cleanHooks[event] ?? [])
        );
      }
      expect(Object.values(cleanHooks).flatMap(kkCommands).length).toBeGreaterThan(0);
    } finally {
      cleanSandbox(clean);
    }
  });

  it('rejects a malformed hooks array with a clear error before writing anything', async () => {
    const original = `${JSON.stringify(
      { hooks: { Stop: [{ hooks: [{ type: 'prompt', prompt: 'x' }] }, 'not-an-object'] } },
      null,
      2
    )}\n`;
    writeFileSync(settingsFile, original);

    const result = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(result.exitCode).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toContain('Cannot read properties');
    expect(output).toContain(settingsFile);
    expect(output).toContain('hooks.Stop[1]');

    expect(readFileSync(settingsFile, 'utf8')).toBe(original);
    expect(existsSync(join(sandbox, '.ai/kenkeep/.state/installed-version'))).toBe(false);
    expect(existsSync(join(sandbox, '.ai/kenkeep/hooks/claude'))).toBe(false);
    expect(existsSync(join(sandbox, '.claude/skills'))).toBe(false);
  });
});
