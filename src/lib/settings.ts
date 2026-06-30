import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { SettingsSchema, type ModelChoice, type SettingsFile } from './schemas.js';

export type { ModelChoice };

export type ModelChoiceRole = 'proposal' | 'curator' | 'bootstrap';

/**
 * Documented defaults for the user-facing settings.
 */
export interface NotificationSettings {
  enabled: boolean;
  backends: Record<string, never>;
}

export interface SettingsDefaults {
  curationThreshold: number;
  logsRetentionDays: number;
  lintEveryNSessions: number;
  notifications: NotificationSettings;
}

export const SETTINGS_DEFAULTS: SettingsDefaults = {
  curationThreshold: 20,
  logsRetentionDays: 30,
  lintEveryNSessions: 50,
  notifications: {
    enabled: true,
    backends: {},
  },
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
      if (key === 'notifications') {
        target.notifications = {
          enabled: src.notifications?.enabled ?? SETTINGS_DEFAULTS.notifications.enabled,
          backends: src.notifications?.backends ?? SETTINGS_DEFAULTS.notifications.backends,
        };
      } else {
        (target as Record<string, unknown>)[key] = value;
      }
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
export function projectConfigPath(kkDir: string): string {
  return join(kkDir, 'config.yaml');
}

/**
 * The default committed `config.yaml` body. Written by `init` and
 * `init --upgrade` when the file does not exist.
 *
 * The serialized YAML is preceded by a short comment block that documents
 * the per-harness shape of `proposalModel` / `curatorModel` /
 * `bootstrapModel`, so a human editing the file knows which fields each
 * harness expects without consulting the source.
 */
export function defaultProjectConfigBody(): string {
  const body: SettingsFile = {
    schema_version: 1,
    curationThreshold: SETTINGS_DEFAULTS.curationThreshold,
    logsRetentionDays: SETTINGS_DEFAULTS.logsRetentionDays,
    lintEveryNSessions: SETTINGS_DEFAULTS.lintEveryNSessions,
    notifications: SETTINGS_DEFAULTS.notifications,
  };
  const header = [
    '# kenkeep project settings.',
    '#',
    '# Per-call model selection (optional). proposalModel, curatorModel, and',
    '# bootstrapModel each take one entry keyed by the `harness` discriminator;',
    '# only the variant whose `harness` matches the active adapter is consumed,',
    '# the others are ignored. Per-harness shapes:',
    '#',
    '#   claude:   { harness: claude, name: haiku|sonnet|opus,',
    '#               effort: low|medium|high|xhigh|max }',
    '#   codex:    { harness: codex, model: <id>, reasoningEffort: <str>? }',
    '#   opencode: { harness: opencode, model: <id>, agent: <str>? }',
    '#   cursor:   { harness: cursor, model: <id> }',
    '#   copilot:  { harness: copilot, model: <id> }',
    '#',
    '# Uncomment one and fill in the fields for your harness from the shapes above:',
    '#',
    '# proposalModel:',
    '#   harness: <harness>',
    '#   ...',
    '#',
    '# curatorModel:',
    '#   harness: <harness>',
    '#   ...',
    '#',
    '# bootstrapModel:',
    '#   harness: <harness>',
    '#   ...',
    '#',
    '# cliDefaultHarness: <harness>   # fallback adapter for plain-shell CLI runs',
    '#                                # (e.g. `npx kenkeep curate`). Skills and',
    '#                                # hooks ignore this; they resolve via env',
    '#                                # detection or the explicit `--harness <id>`',
    '#                                # flag.',
    '#',
    '# Native OS notifications for actionable hook nudges are enabled by default',
    '# when a supported local backend exists. Uncomment to opt out globally:',
    '#',
    '# notifications:',
    '#   enabled: false',
    '#   backends: {}   # reserved for future backend-specific options',
    '',
  ].join('\n');
  return `${header}${yaml.dump(body, { indent: 2, lineWidth: 0, noRefs: true })}`;
}

export function pickModelChoice(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): ModelChoice | undefined {
  switch (role) {
    case 'proposal':
      return settings.proposalModel;
    case 'curator':
      return settings.curatorModel;
    case 'bootstrap':
      return settings.bootstrapModel;
  }
}
