import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SETTINGS_DEFAULTS,
  defaultProjectConfigBody,
  defaultUserConfigPath,
  projectConfigPath,
  resolveSettings,
} from '../../src/lib/settings.js';

describe('settings', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kb-settings-'));
  });
  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  it('falls back to documented defaults when no files exist', () => {
    const result = resolveSettings({
      projectFile: join(sandbox, 'missing-project.json'),
      userFile: join(sandbox, 'missing-user.json'),
    });
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
    expect(result.warnings).toEqual([]);
    expect(result.userFile).toBeNull();
  });

  it('layers user overrides on top of defaults', () => {
    const userFile = join(sandbox, 'user.json');
    writeFileSync(
      userFile,
      JSON.stringify({ schema_version: 1, drainBound: 99, indexBudgetTokens: 4096 }),
    );
    const result = resolveSettings({
      projectFile: join(sandbox, 'missing.json'),
      userFile,
    });
    expect(result.settings.drainBound).toBe(99);
    expect(result.settings.indexBudgetTokens).toBe(4096);
    expect(result.settings.maxAttempts).toBe(SETTINGS_DEFAULTS.maxAttempts);
  });

  it('layers project overrides on top of user overrides', () => {
    const userFile = join(sandbox, 'user.json');
    const projectFile = join(sandbox, 'project.json');
    writeFileSync(userFile, JSON.stringify({ schema_version: 1, drainBound: 10 }));
    writeFileSync(projectFile, JSON.stringify({ schema_version: 1, drainBound: 3 }));
    const result = resolveSettings({ projectFile, userFile });
    expect(result.settings.drainBound).toBe(3);
  });

  it('emits a warning and treats invalid JSON as absent', () => {
    const projectFile = join(sandbox, 'project.json');
    writeFileSync(projectFile, '{ not json');
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.json'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('not valid JSON');
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('emits a warning and treats schema mismatch as absent', () => {
    const projectFile = join(sandbox, 'project.json');
    writeFileSync(projectFile, JSON.stringify({ schema_version: 1, drainBound: -5 }));
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.json'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('schema validation');
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('rejects unknown keys (strict schema)', () => {
    const projectFile = join(sandbox, 'project.json');
    writeFileSync(projectFile, JSON.stringify({ schema_version: 1, mystery: 1 }));
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.json'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('defaultProjectConfigBody round-trips through resolveSettings', () => {
    const projectFile = join(sandbox, 'project.json');
    writeFileSync(projectFile, defaultProjectConfigBody());
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.json'),
    });
    expect(result.warnings).toEqual([]);
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('defaultUserConfigPath honors XDG_CONFIG_HOME', () => {
    const xdg = join(sandbox, 'xdg');
    mkdirSync(xdg, { recursive: true });
    const path = defaultUserConfigPath({ XDG_CONFIG_HOME: xdg } as NodeJS.ProcessEnv);
    expect(path).toBe(join(xdg, '@e0ipso', 'ai-knowledge-base', 'config.json'));
  });

  it('defaultUserConfigPath falls back to ~/.config when XDG is unset', () => {
    const path = defaultUserConfigPath({} as NodeJS.ProcessEnv);
    expect(dirname(path)).toMatch(/[\\/]@e0ipso[\\/]ai-knowledge-base$/);
  });

  it('projectConfigPath joins to the kb dir', () => {
    expect(projectConfigPath('/repo/.ai/knowledge-base')).toBe(
      '/repo/.ai/knowledge-base/.config.json',
    );
  });
});
