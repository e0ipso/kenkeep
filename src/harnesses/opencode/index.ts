import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { openCodeDoctorChecks } from './doctor.js';
import { runHeadlessOpenCode } from './headless.js';
import { openCodeHookSpecs } from './hook-spec.js';
import { installOpenCode } from './install.js';
import { buildOpenCodeHarnessOpts } from './opts.js';
import { parseOpenCodeTranscriptText, renderOpenCodeTranscript } from './transcript.js';

/**
 * OpenCode harness adapter. OpenCode's extension surface is a long-lived
 * TS/JS plugin module (`.opencode/plugins/kk.mjs`) rather than per-event
 * shell commands, so the adapter sets `pluginsDir` instead of `hooksDir`.
 * Per-event handlers ship as Node scripts under `.opencode/kk-hooks/`
 * that the plugin shim spawns on each subscribed event.
 *
 * `detectFromEnv` is intentionally omitted: OpenCode exports no
 * in-session env var that we can rely on. Callers select the adapter
 * via `--harness opencode` (CLI), `--hint opencode` (skill helper), or
 * `cliDefaultHarness: opencode` in `config.yaml`.
 */
function openCodePaths(root: string): HarnessPaths {
  const dir = join(root, '.opencode');
  return {
    dir,
    pluginsDir: join(dir, 'plugins'),
    skillsDir: join(dir, 'skills'),
  };
}

export const openCodeAdapter: HarnessAdapter = {
  id: 'opencode',
  launchBinary: 'opencode',
  launchArgsPrefix: ['run'],
  hooks: openCodeHookSpecs,
  paths: openCodePaths,
  install: opts => installOpenCode(opts),
  upgrade: opts => installOpenCode(opts),
  parseTranscript: parseOpenCodeTranscriptText,
  renderTranscript: renderOpenCodeTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessOpenCode(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildOpenCodeHarnessOpts(settings, role),
  doctorChecks: paths => openCodeDoctorChecks(paths),
  // OpenCode has no native auto-memory feature today; return [] without
  // spawning a child. The interface stays uniform across adapters.
  listMemoryFiles: async () => [],
};
