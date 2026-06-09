import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, projectConfigPath, resolveSettings } from '../../src/lib/settings.js';
import { SettingsSchema } from '../../src/lib/schemas.js';

describe('settings', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kk-settings-'));
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
    expect(projectConfigPath('/repo/.ai/kenkeep')).toBe('/repo/.ai/kenkeep/config.yaml');
  });

  it('accepts a complete claude model choice and treats all three keys as optional', () => {
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        proposalModel: { harness: 'claude', name: 'haiku', effort: 'low' },
      }).success
    ).toBe(true);
    expect(SettingsSchema.safeParse({ schema_version: 1 }).success).toBe(true);
  });

  it('accepts a codex model choice with opaque strings', () => {
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        curatorModel: { harness: 'codex', model: 'gpt-5-codex' },
      }).success
    ).toBe(true);
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        curatorModel: {
          harness: 'codex',
          model: 'gpt-5-codex',
          reasoningEffort: 'high',
        },
      }).success
    ).toBe(true);
  });

  it('rejects invalid claude variants and missing discriminator', () => {
    const invalid = [
      // Missing harness discriminator.
      { proposalModel: { name: 'haiku', effort: 'low' } },
      // Wrong family.
      { proposalModel: { harness: 'claude', name: 'turbo', effort: 'low' } },
      // Wrong effort.
      { proposalModel: { harness: 'claude', name: 'haiku', effort: 'turbo' } },
      // Half-set.
      { proposalModel: { harness: 'claude', name: 'haiku' } },
      { proposalModel: { harness: 'claude', effort: 'low' } },
      // Strict: extra key not allowed.
      {
        proposalModel: {
          harness: 'claude',
          name: 'haiku',
          effort: 'low',
          extra: true,
        },
      },
    ];
    for (const payload of invalid) {
      const result = SettingsSchema.safeParse({ schema_version: 1, ...payload });
      expect(result.success).toBe(false);
    }
  });

  it('rejects invalid codex variants (empty model, strict mode)', () => {
    const invalid = [
      { curatorModel: { harness: 'codex' } },
      { curatorModel: { harness: 'codex', model: '' } },
      { curatorModel: { harness: 'codex', model: 'gpt-5-codex', extra: true } },
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
        curatorModel: { harness: 'claude', name: 'haiku' },
      }).success
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({
        schema_version: 1,
        bootstrapModel: { harness: 'claude', name: 'sonnet', effort: 'turbo' },
      }).success
    ).toBe(false);
  });
});
