import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { claudeDoctorChecks } from './doctor.js';
import { runHeadlessClaude } from './headless.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { installClaude } from './install.js';
import { buildClaudeHarnessOpts } from './opts.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';
import { parseTranscriptJsonl } from './transcript.js';

/**
 * Claude Code harness adapter. Bundles the hook specs, transcript parser,
 * headless runner, install logic, and doctor checks that are specific to
 * Claude Code into a single plug.
 *
 * Register additional harnesses (Codex, OpenCode, ...) by adding a sibling
 * directory under `src/harnesses/` and entering it in the registry.
 */
/**
 * Returns true when the process appears to be running inside a Claude Code
 * session. `CLAUDECODE=1` is the explicit marker Claude Code exports; we
 * also accept a non-empty `CLAUDE_PROJECT_DIR` because every Claude hook
 * command is invoked with that variable set.
 */
function detectClaudeFromEnv(env: NodeJS.ProcessEnv): boolean {
  if (env['CLAUDECODE'] === '1') return true;
  const projectDir = env['CLAUDE_PROJECT_DIR'];
  return typeof projectDir === 'string' && projectDir.length > 0;
}

function claudePaths(root: string): HarnessPaths {
  const dir = join(root, '.claude');
  return {
    dir,
    commandsDir: join(dir, 'commands'),
    skillsDir: join(dir, 'skills'),
    hooksDir: join(dir, 'hooks'),
    settingsFile: join(dir, 'settings.json'),
  };
}

export const claudeAdapter: HarnessAdapter = {
  id: 'claude',
  hooks: CLAUDE_HOOK_SPECS,
  paths: claudePaths,
  install: opts => installClaude(opts),
  upgrade: opts => installClaude(opts),
  parseTranscript: parseTranscriptJsonl,
  renderTranscript: renderRoleTagged,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessClaude(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildClaudeHarnessOpts(settings, role),
  doctorChecks: paths => claudeDoctorChecks(paths),
  detectFromEnv: detectClaudeFromEnv,
};
