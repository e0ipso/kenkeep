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
import { SettingsSchema } from '../../src/lib/schemas.js';

describe('settings', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kb-settings-'));
  });
  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  it('falls back to documented defaults when no files exist', () => {
    const result = resolveSettings({
      projectFile: join(sandbox, 'missing-project.yaml'),
      userFile: join(sandbox, 'missing-user.yaml'),
    });
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
    expect(result.warnings).toEqual([]);
    expect(result.userFile).toBeNull();
  });

  it('layers user overrides on top of defaults', () => {
    const userFile = join(sandbox, 'user.yaml');
    writeFileSync(userFile, 'schema_version: 1\ndrainBound: 99\nindexBudgetTokens: 4096\n');
    const result = resolveSettings({
      projectFile: join(sandbox, 'missing.yaml'),
      userFile,
    });
    expect(result.settings.drainBound).toBe(99);
    expect(result.settings.indexBudgetTokens).toBe(4096);
    expect(result.settings.maxAttempts).toBe(SETTINGS_DEFAULTS.maxAttempts);
  });

  it('layers project overrides on top of user overrides', () => {
    const userFile = join(sandbox, 'user.yaml');
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(userFile, 'schema_version: 1\ndrainBound: 10\n');
    writeFileSync(projectFile, 'schema_version: 1\ndrainBound: 3\n');
    const result = resolveSettings({ projectFile, userFile });
    expect(result.settings.drainBound).toBe(3);
  });

  it('emits a warning and treats invalid YAML as absent', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ndrainBound: [unterminated\n');
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.yaml'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('not valid YAML');
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('emits a warning and treats schema mismatch as absent', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ndrainBound: -5\n');
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.yaml'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('schema validation');
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('rejects unknown keys (strict schema)', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\nmystery: 1\n');
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.yaml'),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('defaultProjectConfigBody round-trips through resolveSettings', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, defaultProjectConfigBody());
    const result = resolveSettings({
      projectFile,
      userFile: join(sandbox, 'missing.yaml'),
    });
    expect(result.warnings).toEqual([]);
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('defaultUserConfigPath honors XDG_CONFIG_HOME', () => {
    const xdg = join(sandbox, 'xdg');
    mkdirSync(xdg, { recursive: true });
    const path = defaultUserConfigPath({ XDG_CONFIG_HOME: xdg } as NodeJS.ProcessEnv);
    expect(path).toBe(join(xdg, 'ai-knowledge-base', 'config.yaml'));
  });

  it('defaultUserConfigPath falls back to ~/.config when XDG is unset', () => {
    const path = defaultUserConfigPath({} as NodeJS.ProcessEnv);
    expect(dirname(path)).toMatch(/[\\/]ai-knowledge-base$/);
    expect(path.endsWith('config.yaml')).toBe(true);
  });

  it('projectConfigPath joins to the kb dir', () => {
    expect(projectConfigPath('/repo/.ai/knowledge-base')).toBe(
      '/repo/.ai/knowledge-base/config.yaml'
    );
  });

  it('accepts a complete model choice and treats all three keys as optional', () => {
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        stage2Model: { name: 'haiku', effort: 'low' },
      }).success
    ).toBe(true);
    expect(SettingsSchema.safeParse({ schema_version: 1 }).success).toBe(true);
  });

  it('rejects invalid or half-set model choices', () => {
    const invalid = [
      { stage2Model: { name: 'turbo', effort: 'low' } },
      { stage2Model: { name: 'haiku', effort: 'turbo' } },
      { stage2Model: { name: 'haiku' } },
      { stage2Model: { effort: 'low' } },
      { stage2Model: { name: 'haiku', effort: 'low', extra: true } },
    ];
    for (const payload of invalid) {
      const result = SettingsSchema.safeParse({ schema_version: 1, ...payload });
      expect(result.success).toBe(false);
    }
  });

  it('rejects the same shapes on curatorModel and bootstrapModel', () => {
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        curatorModel: { name: 'haiku' },
      }).success
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        bootstrapModel: { name: 'sonnet', effort: 'turbo' },
      }).success
    ).toBe(false);
  });
});
