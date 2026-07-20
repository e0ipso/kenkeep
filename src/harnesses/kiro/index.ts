import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
 * Internal implementation of `listMemoryFiles` extracted for testability.
 * The `root` and `home` parameters allow tests to inject temporary directories
 * without relying on `vi.mock` hoisting (which cannot reference `beforeEach`-
 * allocated variables). Production calls always use the zero-argument async
 * wrapper in `kiroAdapter.listMemoryFiles`.
 */
function kiroListMemoryFilesImpl(root: string, home: string): string[] {
  const dirs = [join(root, '.kiro', 'steering'), join(home, '.kiro', 'steering')];
  const out: string[] = [];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.md')) continue;
        out.push(pathToFileURL(join(dir, name)).href);
      }
    } catch {
      // Non-fatal: directory may have changed between existsSync and readdirSync
    }
  }
  return out;
}

/**
 * Kiro CLI (`kiro-cli-chat`) harness adapter.
 *
 * Provides the full kenkeep surface for the Kiro CLI:
 *   - Session lifecycle hooks via Kiro's `agentSpawn`, `stop`, and
 *     `userPromptSubmit` events, registered in `.kiro/agents/kk-hooks.json`
 *   - Transcript parsing of Kiro's JSON session format
 *   - Headless LLM runner via `kiro-cli-chat chat --no-interactive`
 *   - Skill installation to `.kiro/skills/`
 *   - listMemoryFiles reading `.kiro/steering/` and `~/.kiro/steering/`
 *
 * `detectFromEnv` checks for `KIRO_SESSION_ID` — set by Kiro CLI in active
 * sessions.
 *
 * Skills install to `.kiro/skills/<name>/SKILL.md`. Hook scripts install to
 * `.ai/kenkeep/hooks/kiro/`. The `.kiro/agents/kk-hooks.json` agent config
 * registers the hooks; Kiro reads all `.kiro/agents/*.json` files on startup.
 */
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
  listMemoryFiles: async () => kiroListMemoryFilesImpl(findRepoRoot(), homedir()),
};

/**
 * Test helper: calls the internal memory-file implementation with explicit
 * `root` and `home` directories. Production code always uses the adapter's
 * `listMemoryFiles()` method. Exported only for tests — do not call from
 * production code.
 */
export function kiroListMemoryFiles(root: string, home: string): string[] {
  return kiroListMemoryFilesImpl(root, home);
}
