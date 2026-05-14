import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { SettingsSchema, type ModelChoice, type SettingsFile } from './schemas.js';

/**
 * Documented defaults for the user-facing settings.
 */
export const SETTINGS_DEFAULTS = {
  curationThreshold: 5,
  logsRetentionDays: 30,
  lintEveryNSessions: 50,
} as const;

/**
 * Thresholds for the cursory-session pre-filter. A session matching all three
 * cannot have established a durable convention; the proposal worker is skipped.
 * Hardcoded by design: promoting these to config is a one-line change later.
 */
export const CURSORY_MAX_USER_TURNS = 1;
export const CURSORY_MAX_USER_CHARS = 200;
export const CURSORY_MAX_AGENT_CHARS = 500;

export type EffectiveSettings = {
  -readonly [K in keyof typeof SETTINGS_DEFAULTS]: (typeof SETTINGS_DEFAULTS)[K];
} & {
  proposalModel?: ModelChoice;
  curatorModel?: ModelChoice;
  bootstrapModel?: ModelChoice;
  /** Fallback harness id for plain-shell CLI invocations. Skills/hooks resolve via env detection. */
  cliDefaultHarness?: string;
};

const MODEL_CHOICE_KEYS = ['proposalModel', 'curatorModel', 'bootstrapModel'] as const;

export type ResolveSettingsResult = {
  settings: EffectiveSettings;
  projectFile: string | null;
};

export interface ResolveOptions {
  projectFile?: string;
}

/**
 * Resolves the effective settings: defaults layered under project-file overrides.
 * A missing project file is a no-op. A present-but-malformed file throws.
 */
export function resolveSettings(opts: ResolveOptions = {}): ResolveSettingsResult {
  const projectFile = opts.projectFile ?? null;
  const project = projectFile ? loadFile(projectFile) : null;

  const effective: EffectiveSettings = { ...SETTINGS_DEFAULTS };
  applyOverrides(effective, project);

  return {
    settings: effective,
    projectFile,
  };
}

function applyOverrides(target: EffectiveSettings, src: SettingsFile | null): void {
  if (!src) return;
  for (const key of Object.keys(SETTINGS_DEFAULTS) as Array<keyof typeof SETTINGS_DEFAULTS>) {
    const value = src[key];
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value as never;
    }
  }
  for (const key of MODEL_CHOICE_KEYS) {
    const value = src[key];
    if (value !== undefined) target[key] = value;
  }
  if (src.cliDefaultHarness !== undefined) target.cliDefaultHarness = src.cliDefaultHarness;
}

function loadFile(file: string): SettingsFile | null {
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`settings file is not valid YAML (${file}): ${(err as Error).message}`);
  }
  const result = SettingsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`settings file failed schema validation (${file}): ${result.error.message}`);
  }
  return result.data;
}

/**
 * The committed project-level path inside a consuming repo.
 */
export function projectConfigPath(kbDir: string): string {
  return join(kbDir, 'config.yaml');
}

/**
 * The default committed `config.yaml` body. Written by `init` and
 * `init --upgrade` when the file does not exist.
 */
export function defaultProjectConfigBody(): string {
  const body: SettingsFile = {
    schema_version: 1,
    curationThreshold: SETTINGS_DEFAULTS.curationThreshold,
    logsRetentionDays: SETTINGS_DEFAULTS.logsRetentionDays,
    lintEveryNSessions: SETTINGS_DEFAULTS.lintEveryNSessions,
  };
  return yaml.dump(body, { indent: 2, lineWidth: 0, noRefs: true });
}
