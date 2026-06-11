import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { codexDoctorChecks } from './doctor.js';
import { runHeadlessCodex } from './headless.js';
import { codexHookSpecs } from './hook-spec.js';
import { installCodex } from './install.js';
import { buildCodexHarnessOpts } from './opts.js';
import { parseCodexTranscript, renderCodexTranscript } from './transcript.js';

/**
 * OpenAI Codex CLI harness adapter. Bundles the hook specs, transcript
 * parser, headless runner, install logic, and doctor checks specific to
 * Codex into a single plug. Codex emits no reliable child-process env
 * var, so `detectFromEnv` is omitted: callers must select the adapter
 * via the explicit `--harness codex` CLI flag or via `cliDefaultHarness`
 * in `config.yaml`.
 */
function codexPaths(root: string): HarnessPaths {
  const dir = join(root, '.codex');
  return {
    dir,
    skillsDir: join(root, '.agents/skills'),
    hooksDir: join(dir, 'hooks'),
    settingsFile: join(dir, 'hooks.json'),
  };
}

export const codexAdapter: HarnessAdapter = {
  id: 'codex',
  launchBinary: 'codex',
  launchArgsPrefix: ['exec'],
  hooks: codexHookSpecs,
  paths: codexPaths,
  install: opts => installCodex(opts),
  upgrade: opts => installCodex(opts),
  parseTranscript: parseCodexTranscript,
  renderTranscript: renderCodexTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessCodex(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildCodexHarnessOpts(settings, role),
  doctorChecks: paths => codexDoctorChecks(paths),
  // Codex CLI has no native auto-memory feature today; return [] without
  // spawning a child. The interface stays uniform across adapters.
  listMemoryFiles: async () => [],
};
