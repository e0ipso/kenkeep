import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeClaudeHookConfig } from '../../src/harnesses/claude/hooks-config.js';

describe('writeClaudeHookConfig', () => {
  let root: string;
  let settingsFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-hooks-config-'));
    settingsFile = join(root, '.claude/settings.json');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates .claude/settings.json with supplied hooks when no file exists', async () => {
    expect(existsSync(settingsFile)).toBe(false);
    await writeClaudeHookConfig(root, [
      { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.cjs' },
    ]);
    expect(existsSync(settingsFile)).toBe(true);
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    expect(parsed.hooks.Stop).toEqual([
      {
        hooks: [
          {
            type: 'command',
            command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"',
          },
        ],
      },
    ]);
  });

  it('treats an empty settings.json as an empty object', async () => {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(settingsFile, '{}');
    await writeClaudeHookConfig(root, [
      { event: 'SessionEnd', scriptPath: '.claude/hooks/kb-capture.cjs' },
    ]);
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    expect(parsed.hooks.SessionEnd).toHaveLength(1);
    expect(parsed.hooks.SessionEnd[0].hooks[0].command).toBe(
      'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"'
    );
  });

  it('preserves foreign hooks (commands without the .claude/hooks/kb- prefix)', async () => {
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
                  command: 'node ./scripts/user-stop.mjs',
                },
              ],
            },
          ],
        },
      })
    );

    await writeClaudeHookConfig(root, [
      { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const commands = parsed.hooks.Stop.flatMap((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.map(h => h.command)
    );
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"');
  });

  it('scrubs previously-owned kb- hooks before rewriting', async () => {
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
                  command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-old-name.mjs"',
                },
              ],
            },
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node ./scripts/user-stop.mjs',
                },
              ],
            },
          ],
        },
      })
    );

    await writeClaudeHookConfig(root, [
      { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const commands = parsed.hooks.Stop.flatMap((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.map(h => h.command)
    );
    expect(commands).not.toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-old-name.mjs"');
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"');
  });

  it('removes an event entry whose only hooks were kb- owned (before re-adding)', async () => {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(
      settingsFile,
      JSON.stringify({
        hooks: {
          PreCompact: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-old.mjs"',
                },
              ],
            },
          ],
          SessionEnd: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.cjs"',
                },
              ],
            },
          ],
        },
      })
    );

    // Supply only a Stop hook; PreCompact and SessionEnd should be cleared
    // because their only entries were kb-owned and no new hooks for them are
    // requested.
    await writeClaudeHookConfig(root, [
      { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    expect(parsed.hooks.PreCompact).toBeUndefined();
    expect(parsed.hooks.SessionEnd).toBeUndefined();
    expect(parsed.hooks.Stop).toHaveLength(1);
  });

  it('emits async: true only when the spec sets it', async () => {
    await writeClaudeHookConfig(root, [
      { event: 'SessionStart', scriptPath: '.claude/hooks/kb-session-start.cjs' },
      { event: 'SessionStart', scriptPath: '.claude/hooks/kb-proposal-drain.cjs', async: true },
    ]);

    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const entries = parsed.hooks.SessionStart as Array<{
      hooks: Array<{ command: string; async?: boolean }>;
    }>;
    const sessionStart = entries
      .flatMap(e => e.hooks)
      .find(h => h.command.includes('kb-session-start.cjs'));
    const drain = entries
      .flatMap(e => e.hooks)
      .find(h => h.command.includes('kb-proposal-drain.cjs'));
    expect(sessionStart).toBeDefined();
    expect(drain).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(sessionStart, 'async')).toBe(false);
    expect(drain!.async).toBe(true);
  });

  it('preserves matcher when set', async () => {
    await writeClaudeHookConfig(root, [
      {
        event: 'UserPromptSubmit',
        scriptPath: '.claude/hooks/kb-filter.cjs',
        matcher: '**/*.md',
      },
    ]);
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
    expect(parsed.hooks.UserPromptSubmit[0].matcher).toBe('**/*.md');
  });

  it('throws when the existing settings.json is unparseable', async () => {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(settingsFile, '{ not json');
    await expect(
      writeClaudeHookConfig(root, [{ event: 'Stop', scriptPath: '.claude/hooks/kb-capture.cjs' }])
    ).rejects.toThrow(/Could not parse existing/);
  });
});
