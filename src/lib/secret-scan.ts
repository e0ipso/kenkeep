import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SecretScanStatus } from './schemas.js';

export interface SecretFinding {
  ruleId: string;
  secret: string;
  startLine?: number;
  endLine?: number;
}

export interface SecretScanResult {
  status: SecretScanStatus;
  redactedText: string;
  findings: SecretFinding[];
  error?: string;
}

export type SecretScanner = (text: string) => Promise<SecretScanResult>;

const FALLBACK_CONFIG = {
  rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }],
};

/**
 * Replaces each finding's `secret` substring with `[REDACTED:<ruleId>]`.
 * Longest-first ordering keeps overlapping matches from leaking partials.
 */
export function redactSecrets(text: string, findings: SecretFinding[]): string {
  const ordered = [...findings].sort((a, b) => (b.secret?.length ?? 0) - (a.secret?.length ?? 0));
  let out = text;
  for (const f of ordered) {
    const secret = f.secret;
    if (typeof secret !== 'string' || secret.length === 0) continue;
    out = out.split(secret).join(`[REDACTED:${f.ruleId}]`);
  }
  return out;
}

async function loadResolvedConfig(cwd: string): Promise<unknown> {
  const { loadConfig } = await import('@secretlint/config-loader');
  const explicit = join(cwd, '.secretlintrc.json');
  if (existsSync(explicit)) {
    const loaded = await loadConfig({ cwd, configFilePath: explicit });
    if (loaded.ok) return loaded.config;
  }
  try {
    const loaded = await loadConfig({ cwd });
    if (loaded.ok) return loaded.config;
  } catch {
    // fall through to bundled config
  }
  const { loadPackagesFromConfigDescriptor } = await import('@secretlint/config-loader');
  const loaded = await loadPackagesFromConfigDescriptor({
    configDescriptor: FALLBACK_CONFIG as never,
  });
  return loaded.config;
}

/**
 * Runs secretlint against the provided text. Times out after `timeoutMs`
 * (default 1000 ms). On timeout or library failure, returns `blocked`
 * so stage-1 capture aborts per IMPLEMENTATION §5.1.
 */
export async function scanAndRedact(text: string, timeoutMs = 1000): Promise<SecretScanResult> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const cwd = process.cwd();
    const config = await loadResolvedConfig(cwd);
    const { lintSource } = await import('@secretlint/core');

    const linted = await Promise.race([
      lintSource({
        source: {
          filePath: join(cwd, '__transcript__.txt'),
          content: text,
          contentType: 'text',
        },
        options: {
          config: config as never,
          noPhysicFilePath: true,
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`secretlint timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);

    const findings: SecretFinding[] = [];
    for (const m of linted.messages) {
      if (m.type !== 'message') continue;
      const [start, end] = m.range;
      if (typeof start !== 'number' || typeof end !== 'number' || end <= start) continue;
      const secret = text.slice(start, end);
      if (secret.length === 0) continue;
      findings.push({
        ruleId: m.ruleId,
        secret,
        startLine: m.loc?.start?.line,
        endLine: m.loc?.end?.line,
      });
    }

    if (findings.length === 0) {
      return { status: 'clean', redactedText: text, findings: [] };
    }
    return {
      status: 'redacted',
      redactedText: redactSecrets(text, findings),
      findings,
    };
  } catch (err) {
    const e = err as Error;
    return {
      status: 'blocked',
      redactedText: '',
      findings: [],
      error: e.message,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
