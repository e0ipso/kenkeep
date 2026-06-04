import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HarnessPaths } from '../../../src/harnesses/types.js';
import {
  SENTINEL_END,
  SENTINEL_START,
  writeCopilotHookConfig,
  writeCopilotInstructionsSentinel,
} from '../../../src/harnesses/copilot/hooks-config.js';

function harnessPaths(root: string, home: string): HarnessPaths {
  return {
    dir: join(root, '.copilot'),
    hooksDir: join(root, '.copilot', 'hooks'),
    skillsDir: join(root, '.github', 'skills'),
    settingsFile: join(home, 'hooks', 'kk.json'),
  };
}

describe('writeCopilotHookConfig', () => {
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
    const paths = harnessPaths(root, home);
    await writeCopilotHookConfig(paths);

    const projectFile = join(root, '.copilot', 'hooks', 'kk.json');
    const userFile = join(home, 'hooks', 'kk.json');
    expect(existsSync(projectFile)).toBe(true);
    expect(existsSync(userFile)).toBe(true);
    expect(readFileSync(projectFile, 'utf8')).toBe(readFileSync(userFile, 'utf8'));

    const parsed = JSON.parse(readFileSync(userFile, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.hooks).sort()).toEqual(['agentStop', 'sessionEnd', 'sessionStart']);

    // Every command references an absolute kk-hooks path and carries the guard.
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

  it('is idempotent: rewriting produces byte-identical output', async () => {
    const paths = harnessPaths(root, home);
    await writeCopilotHookConfig(paths);
    const first = readFileSync(join(home, 'hooks', 'kk.json'), 'utf8');
    await writeCopilotHookConfig(paths);
    const second = readFileSync(join(home, 'hooks', 'kk.json'), 'utf8');
    expect(second).toBe(first);
  });
});

describe('writeCopilotInstructionsSentinel', () => {
  let root: string;
  let home: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-copilot-sentinel-'));
    home = mkdtempSync(join(tmpdir(), 'kk-copilot-home-'));
    // Seed an INDEX so the block carries real content.
    mkdirSync(join(root, '.ai', 'kenkeep'), { recursive: true });
    writeFileSync(join(root, '.ai', 'kenkeep', 'INDEX.md'), '# Knowledge base index\n\n_0 nodes_\n');
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('appends a sentinel block while preserving user content outside it', async () => {
    const instructionsFile = join(root, '.github', 'copilot-instructions.md');
    mkdirSync(join(root, '.github'), { recursive: true });
    writeFileSync(instructionsFile, 'USER CONTENT HERE\n');

    await writeCopilotInstructionsSentinel(harnessPaths(root, home));

    const body = readFileSync(instructionsFile, 'utf8');
    expect(body).toContain('USER CONTENT HERE');
    expect(body).toContain(SENTINEL_START);
    expect(body).toContain(SENTINEL_END);
    expect(body).toContain('Knowledge base index');
    // Exactly one block.
    expect(body.split(SENTINEL_START)).toHaveLength(2);
  });

  it('replaces the existing block in place on re-run with the same INDEX (zero-diff)', async () => {
    const instructionsFile = join(root, '.github', 'copilot-instructions.md');
    await writeCopilotInstructionsSentinel(harnessPaths(root, home));
    const first = readFileSync(instructionsFile, 'utf8');
    await writeCopilotInstructionsSentinel(harnessPaths(root, home));
    const second = readFileSync(instructionsFile, 'utf8');
    expect(second).toBe(first);
    // Still exactly one block, no duplication.
    expect(second.split(SENTINEL_START)).toHaveLength(2);
  });

  it('falls back to a placeholder when INDEX.md is absent', async () => {
    rmSync(join(root, '.ai', 'kenkeep', 'INDEX.md'), { force: true });
    const instructionsFile = join(root, '.github', 'copilot-instructions.md');
    await writeCopilotInstructionsSentinel(harnessPaths(root, home));
    const body = readFileSync(instructionsFile, 'utf8');
    expect(body).toContain(SENTINEL_START);
    expect(body).toContain('.ai/kenkeep/INDEX.md');
  });
});
