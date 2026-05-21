import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cursorHookConfigPaths,
  readCursorHooks,
  writeCursorHooksConfig,
} from '../../../src/harnesses/cursor/hooks-config.js';

describe('writeCursorHooksConfig', () => {
  let root: string;
  let hooksFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-cursor-hooks-'));
    hooksFile = join(root, '.cursor/hooks.json');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates .cursor/hooks.json with native Cursor shape on a fresh repo', async () => {
    expect(existsSync(hooksFile)).toBe(false);
    await writeCursorHooksConfig(root, [
      { event: 'stop', scriptPath: '.cursor/hooks/kb-capture.cjs' },
      { event: 'sessionStart', scriptPath: '.cursor/hooks/kb-session-start.cjs' },
    ]);
    expect(existsSync(hooksFile)).toBe(true);
    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.stop).toEqual([
      { command: 'node .cursor/hooks/kb-capture.cjs', timeout: 30 },
    ]);
    expect(parsed.hooks.sessionStart[0].command).toBe(
      'node .cursor/hooks/kb-session-start.cjs'
    );
  });

  it('preserves foreign hook entries', async () => {
    mkdirSync(join(root, '.cursor'), { recursive: true });
    writeFileSync(
      hooksFile,
      JSON.stringify({
        version: 1,
        hooks: {
          stop: [{ command: 'node ./scripts/user-stop.mjs', timeout: 10 }],
        },
      })
    );

    await writeCursorHooksConfig(root, [
      { event: 'stop', scriptPath: '.cursor/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    const commands = parsed.hooks.stop.map((e: { command: string }) => e.command);
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node .cursor/hooks/kb-capture.cjs');
  });

  it('scrubs previously-owned kb- hooks before rewriting', async () => {
    mkdirSync(join(root, '.cursor'), { recursive: true });
    writeFileSync(
      hooksFile,
      JSON.stringify({
        version: 1,
        hooks: {
          stop: [
            { command: 'node .cursor/hooks/kb-old-name.cjs', timeout: 30 },
            { command: 'node ./scripts/user-stop.mjs' },
          ],
        },
      })
    );

    await writeCursorHooksConfig(root, [
      { event: 'stop', scriptPath: '.cursor/hooks/kb-capture.cjs' },
    ]);

    const parsed = JSON.parse(readFileSync(hooksFile, 'utf8'));
    const commands = parsed.hooks.stop.map((e: { command: string }) => e.command);
    expect(commands).not.toContain('node .cursor/hooks/kb-old-name.cjs');
    expect(commands).toContain('node ./scripts/user-stop.mjs');
    expect(commands).toContain('node .cursor/hooks/kb-capture.cjs');
  });

  it('readCursorHooks returns defaults when the file does not exist', () => {
    const paths = cursorHookConfigPaths(root);
    expect(readCursorHooks(paths)).toEqual({ version: 1, hooks: {} });
  });
});
