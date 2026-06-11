import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import { log } from '../../lib/log.js';
import { HARNESS_MEMORY_DISCOVERY_PROMPT, MemoryIriListSchema } from '../../lib/memory-files.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { claudeDoctorChecks } from './doctor.js';
import { runHeadlessClaude, runHeadlessClaudeRaw } from './headless.js';
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
 * session. `CLAUDECODE=1` is the explicit marker Claude Code exports in
 * hook subprocesses and headless children.
 */
function detectClaudeFromEnv(env: NodeJS.ProcessEnv): boolean {
  return env['CLAUDECODE'] === '1';
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

async function claudeListMemoryFiles(opts: { timeoutMs?: number } = {}): Promise<string[]> {
  const runOpts: { timeoutMs?: number } = {};
  if (opts.timeoutMs !== undefined) runOpts.timeoutMs = opts.timeoutMs;
  let raw: string;
  try {
    raw = await runHeadlessClaudeRaw(HARNESS_MEMORY_DISCOVERY_PROMPT, '', runOpts);
  } catch (err) {
    log.warn(
      `claude listMemoryFiles: headless child failed (${err instanceof Error ? err.message : String(err)}); returning [].`
    );
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch (err) {
    log.warn(
      `claude listMemoryFiles: child reply was not JSON (${err instanceof Error ? err.message : String(err)}); returning [].`
    );
    return [];
  }

  const validated = MemoryIriListSchema.safeParse(parsed);
  if (!validated.success) {
    log.warn(
      `claude listMemoryFiles: reply did not match string-array schema (${validated.error.message}); returning [].`
    );
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of validated.data) {
    if (!/^file:\/\//.test(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

export const claudeAdapter: HarnessAdapter = {
  id: 'claude',
  launchBinary: 'claude',
  launchArgsPrefix: ['-p'],
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
  listMemoryFiles: claudeListMemoryFiles,
};
