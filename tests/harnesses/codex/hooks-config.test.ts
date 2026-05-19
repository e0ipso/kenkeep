import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCodexHooks, codexHookConfigPaths, writeCodexHooks } from '../../../src/harnesses/codex/hooks-config.js';

describe('writeCodexHooks', () => {
  let root: string;
  let hooksFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-codex-hooks-'));
    hooksFile = join(root, '.codex/hooks.json');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates .codex/hooks.json with the canonical shape on a fresh repo', async () => {
    expect(existsSync(hooksFile)).toBe(false);
    await writeCodexHooks(root, [
      { event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' },
      { event: 'SessionStart', scriptPath: '.codex/hooks/kb-session-start.cjs' },
      { event: 'SessionStart', scriptPath: '.codex/hooks/kb-proposal-drain.cjs', async: true },
    ]);
    expect(existsSync(hooksFile)).toBe(true);
    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    expect(parsed.hooks.Stop).toEqual([
      {
        hooks: [
          {
            type: 'command',
            command: 'node ./.codex/hooks/kb-capture.cjs',
            timeout: 30,
          },
        ],
      },
    ]);
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe(
      'node ./.codex/hooks/kb-session-start.cjs'
    );
    expect(parsed.hooks.SessionStart[1].hooks[0].command).toBe(
      'node ./.codex/hooks/kb-proposal-drain.cjs'
    );
  });

  it('is idempotent: rewriting the same specs produces the same file content', async () => {
    const specs = [
      { event: 'Stop' as const, scriptPath: '.codex/hooks/kb-capture.cjs' },
      { event: 'SessionStart' as const, scriptPath: '.codex/hooks/kb-session-start.cjs' },
    ];
    await writeCodexHooks(root, specs);
    const first = readFileSync(hooksFile, 'utf8');
    await writeCodexHooks(root, specs);
    const second = readFileSync(hooksFile, 'utf8');
    expect(second).toBe(first);
  });

  it('preserves foreign hook entries (commands without our prefix)', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(
      hooksFile,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node ./scripts/user-stop.mjs',
                  timeout: 10,
                },
              ],
            },
          ],
        },
      })
    );

    await writeCodexHooks(root, [
      { event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    const commands = parsed.hooks.Stop.flatMap((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.map(h => h.command)
    );
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node ./.codex/hooks/kb-capture.cjs');
  });

  it('scrubs previously-owned kb- hooks before rewriting', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(
      hooksFile,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node ./.codex/hooks/kb-old-name.mjs',
                  timeout: 30,
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

    await writeCodexHooks(root, [
      { event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    const commands = parsed.hooks.Stop.flatMap((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.map(h => h.command)
    );
    expect(commands).not.toContain('node ./.codex/hooks/kb-old-name.mjs');
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node ./.codex/hooks/kb-capture.cjs');
  });

  it('refuses to write when .codex/config.toml defines a [hooks] table', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(
      join(root, '.codex/config.toml'),
      [
        '[hooks]',
        '',
        '[[hooks.Stop]]',
        'command = "echo hi"',
        '',
      ].join('\n')
    );

    let caught: Error | null = null;
    try {
      await writeCodexHooks(root, [
        { event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' },
      ]);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Refusing to write .codex/hooks.json');
    expect(caught!.message).toContain('.codex/config.toml already defines [hooks]');
    expect(caught!.message).toContain(
      'https://github.com/e0ipso/ai-knowledge-base/blob/main/docs/installation/codex-toml-hooks-coexistence.md'
    );
  });

  it('does not trip the TOML guard when .codex/config.toml exists but has no [hooks] table', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(
      join(root, '.codex/config.toml'),
      'model = "gpt-5-codex"\n'
    );
    await writeCodexHooks(root, [
      { event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' },
    ]);
    expect(existsSync(hooksFile)).toBe(true);
  });

  it('throws a clear error when the existing hooks.json is unparseable', async () => {
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(hooksFile, '{ not json');
    await expect(
      writeCodexHooks(root, [{ event: 'Stop', scriptPath: '.codex/hooks/kb-capture.cjs' }])
    ).rejects.toThrow(/Could not parse existing/);
  });

  it('readCodexHooks returns {} when the file does not exist', () => {
    const paths = codexHookConfigPaths(root);
    expect(readCodexHooks(paths)).toEqual({});
  });
});
