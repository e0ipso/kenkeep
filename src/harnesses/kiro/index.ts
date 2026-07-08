import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findRepoRoot } from '../../lib/paths.js';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, ModelChoiceRole } from '../types.js';
import { kiroDoctorChecks } from './doctor.js';
import { runHeadlessKiro } from './headless.js';
import { KIRO_HOOK_SPECS } from './hook-spec.js';
import { installKiro, upgradeKiro, kiroPaths as kiroAdapterPaths } from './install.js';
import { buildKiroHarnessOpts } from './opts.js';
import { parseKiroTranscript, renderKiroTranscript } from './transcript.js';

/**
 * Kiro CLI (`kiro-cli-chat`) harness adapter.
 *
 * Kiro v1 has no session lifecycle hook events — `KIRO_HOOK_SPECS` is empty
 * and no hook scripts are installed. The adapter still provides the full
 * kenkeep surface: transcript parsing, headless programmatic mode, skills
 * installation, doctor checks, and listMemoryFiles (reading project and user
 * steering files as auto-memory inputs for bootstrap/curate).
 *
 * `detectFromEnv` checks for `KIRO_SESSION_ID` — a non-empty string that
 * Kiro exports in active sessions.
 *
 * Skills install to `.kiro/skills/<name>/SKILL.md` (Kiro's documented
 * project skill location). No hook configuration file is written in v1.
 */
/**
 * Returns `file://` IRIs for `.kiro/steering/*.md` files in both the project
 * directory and the user home directory (`~/.kiro/steering/*.md`).
 *
 * These steering files serve the same auto-memory role as Claude Code's
 * memory files: they contain project conventions and user preferences that
 * kenkeep should treat as prior knowledge when running bootstrap/curate.
 *
 * Returns `[]` gracefully when either directory doesn't exist. All errors
 * are caught and suppressed — usage errors must never block capture.
 *
 * Optional `root` and `home` parameters override the defaults (repo root from
 * `findRepoRoot()` and `homedir()`); used only in tests.
 */
export function kiroListMemoryFiles(root?: string, home?: string): string[] {
  const resolvedRoot = root ?? findRepoRoot();
  const resolvedHome = home ?? homedir();
  const dirs = [join(resolvedRoot, '.kiro', 'steering'), join(resolvedHome, '.kiro', 'steering')];
  const out: string[] = [];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.md')) continue;
        out.push(`file://${join(dir, name)}`);
      }
    } catch {
      // Non-fatal: directory may have changed between existsSync and readdirSync
    }
  }
  return out;
}

export const kiroAdapter: HarnessAdapter = {
  id: 'kiro',
  launchBinary: 'kiro-cli-chat',
  launchArgsPrefix: ['chat'],
  hooks: KIRO_HOOK_SPECS,
  paths: kiroAdapterPaths,
  install: opts => installKiro(opts),
  upgrade: opts => upgradeKiro(opts),
  parseTranscript: parseKiroTranscript,
  renderTranscript: renderKiroTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessKiro(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildKiroHarnessOpts(settings, role),
  doctorChecks: paths => kiroDoctorChecks(paths),
  detectFromEnv: (env: NodeJS.ProcessEnv) => {
    const val = env['KIRO_SESSION_ID'];
    return typeof val === 'string' && val.length > 0;
  },
  // listMemoryFiles is sync (FS reads only, no headless spawn); async wrapper
  // satisfies the interface signature Promise<string[]>.
  listMemoryFiles: async () => kiroListMemoryFiles(),
};
