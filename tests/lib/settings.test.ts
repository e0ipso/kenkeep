import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SETTINGS_DEFAULTS,
  defaultProjectConfigBody,
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

  it('falls back to documented defaults when no project file exists', () => {
    const result = resolveSettings({ projectFile: join(sandbox, 'missing.yaml') });
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
    expect(result.projectFile).toBe(join(sandbox, 'missing.yaml'));
  });

  it('layers project overrides on top of defaults', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ncurationThreshold: 11\nlogsRetentionDays: 7\n');
    const result = resolveSettings({ projectFile });
    expect(result.settings.curationThreshold).toBe(11);
    expect(result.settings.logsRetentionDays).toBe(7);
    expect(result.settings.lintEveryNSessions).toBe(SETTINGS_DEFAULTS.lintEveryNSessions);
  });

  it('throws on invalid YAML', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ncurationThreshold: [unterminated\n');
    expect(() => resolveSettings({ projectFile })).toThrow(/not valid YAML/);
  });

  it('throws on schema violation for removed keys', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ndrainBound: 5\n');
    expect(() => resolveSettings({ projectFile })).toThrow(/drainBound/);
  });

  it('rejects unknown keys (strict schema)', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\nmystery: 1\n');
    expect(() => resolveSettings({ projectFile })).toThrow(/mystery/);
  });

  it('defaultProjectConfigBody round-trips through resolveSettings', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, defaultProjectConfigBody());
    const result = resolveSettings({ projectFile });
    expect(result.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('accepts an optional cliDefaultHarness and passes it through', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ncliDefaultHarness: claude\n');
    const result = resolveSettings({ projectFile });
    expect(result.settings.cliDefaultHarness).toBe('claude');
  });

  it('rejects an empty cliDefaultHarness string', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ncliDefaultHarness: ""\n');
    expect(() => resolveSettings({ projectFile })).toThrow();
  });

  it('rejects the legacy `defaultHarness` key (strict schema, no alias)', () => {
    const projectFile = join(sandbox, 'project.yaml');
    writeFileSync(projectFile, 'schema_version: 1\ndefaultHarness: claude\n');
    expect(() => resolveSettings({ projectFile })).toThrow(/defaultHarness/);
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
        proposalModel: { name: 'haiku', effort: 'low' },
      }).success
    ).toBe(true);
    expect(SettingsSchema.safeParse({ schema_version: 1 }).success).toBe(true);
  });

  it('rejects invalid or half-set model choices', () => {
    const invalid = [
      { proposalModel: { name: 'turbo', effort: 'low' } },
      { proposalModel: { name: 'haiku', effort: 'turbo' } },
      { proposalModel: { name: 'haiku' } },
      { proposalModel: { effort: 'low' } },
      { proposalModel: { name: 'haiku', effort: 'low', extra: true } },
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
