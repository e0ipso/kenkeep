import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SettingsSchema, type SettingsFile } from './schemas.js';

/**
 * Documented defaults. These mirror the constants previously hard-coded into
 * `stage2-drain.ts`, `curate.ts`, `bootstrap.ts`, `index-gen.ts`, and
 * `session-start.ts`. Changing a default here changes the value used when no
 * `.config.json` overrides it.
 */
export const SETTINGS_DEFAULTS = {
  drainBound: 5,
  maxAttempts: 3,
  stage2Timeout: 60_000,
  lockTtlMs: 30 * 60 * 1000,
  indexBudgetTokens: 2000,
  curationThreshold: 5,
  bootstrapTokenBudget: 10_000,
  gitleaksRulesPath: null as string | null,
  logsRetentionDays: 30,
} as const;

export type EffectiveSettings = {
  -readonly [K in keyof typeof SETTINGS_DEFAULTS]: (typeof SETTINGS_DEFAULTS)[K];
};

export type ResolveSettingsResult = {
  settings: EffectiveSettings;
  projectFile: string | null;
  userFile: string | null;
  warnings: string[];
};

export interface ResolveOptions {
  projectFile?: string;
  userFile?: string;
}

/**
 * Resolves the effective settings: defaults ← user overrides ← project overrides.
 *
 * Either file may be missing; missing files are silently ignored. A file
 * present but unparseable (invalid JSON / fails Zod) produces a warning and
 * is treated as absent, so a corrupted user file cannot brick the CLI.
 */
export function resolveSettings(opts: ResolveOptions = {}): ResolveSettingsResult {
  const projectFile = opts.projectFile ?? null;
  const userFile = opts.userFile ?? defaultUserConfigPath();
  const warnings: string[] = [];

  const user = loadFile(userFile, warnings);
  const project = projectFile ? loadFile(projectFile, warnings) : null;

  const effective: EffectiveSettings = { ...SETTINGS_DEFAULTS };
  applyOverrides(effective, user);
  applyOverrides(effective, project);

  return {
    settings: effective,
    projectFile: projectFile ?? null,
    userFile: existsSync(userFile) ? userFile : null,
    warnings,
  };
}

function applyOverrides(target: EffectiveSettings, src: SettingsFile | null): void {
  if (!src) return;
  for (const key of Object.keys(SETTINGS_DEFAULTS) as Array<keyof typeof SETTINGS_DEFAULTS>) {
    const value = src[key];
    if (value !== undefined) {
      // `as never` is required because TypeScript cannot prove the per-key
      // value types align across the union; the Zod schema does.
      (target as Record<string, unknown>)[key] = value as never;
    }
  }
}

function loadFile(file: string, warnings: string[]): SettingsFile | null {
  if (!existsSync(file)) return null;
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    warnings.push(`settings file unreadable (${file}): ${(err as Error).message}`);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    warnings.push(`settings file is not valid JSON (${file}): ${(err as Error).message}`);
    return null;
  }
  const result = SettingsSchema.safeParse(parsed);
  if (!result.success) {
    warnings.push(`settings file failed schema validation (${file}): ${result.error.message}`);
    return null;
  }
  return result.data;
}

/**
 * The user-level override path. Honors `XDG_CONFIG_HOME` if set; otherwise
 * falls back to `~/.config/`.
 */
export function defaultUserConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env['XDG_CONFIG_HOME'];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, '@e0ipso', 'ai-knowledge-base', 'config.json');
}

/**
 * The committed project-level path inside a consuming repo.
 */
export function projectConfigPath(kbDir: string): string {
  return join(kbDir, '.config.json');
}

/**
 * The default committed `.config.json` body. Written by `init` and
 * `init --upgrade` when the file does not exist. Includes every supported key
 * with its documented default so users have something to discover and edit.
 */
export function defaultProjectConfigBody(): string {
  const body: SettingsFile = {
    schema_version: 1,
    drainBound: SETTINGS_DEFAULTS.drainBound,
    maxAttempts: SETTINGS_DEFAULTS.maxAttempts,
    stage2Timeout: SETTINGS_DEFAULTS.stage2Timeout,
    lockTtlMs: SETTINGS_DEFAULTS.lockTtlMs,
    indexBudgetTokens: SETTINGS_DEFAULTS.indexBudgetTokens,
    curationThreshold: SETTINGS_DEFAULTS.curationThreshold,
    bootstrapTokenBudget: SETTINGS_DEFAULTS.bootstrapTokenBudget,
    gitleaksRulesPath: SETTINGS_DEFAULTS.gitleaksRulesPath,
    logsRetentionDays: SETTINGS_DEFAULTS.logsRetentionDays,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}
