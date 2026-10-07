import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, ModelChoiceRole } from '../types.js';
import { copilotDoctorChecks } from './doctor.js';
import { runHeadlessCopilot } from './headless.js';
import { copilotHookSpecs } from './hook-spec.js';
import { copilotPaths, installCopilot } from './install.js';
import { buildCopilotHarnessOpts } from './opts.js';
import { parseCopilotTranscript, renderCopilotTranscript } from './transcript.js';

/**
 * GitHub Copilot CLI (`@github/copilot`) harness adapter. Copilot's
 * extension surface is a per-event JSON hook config; the adapter
 * aggregates every event handler into a single `kk.json` document written
 * to the **repo-level** `.github/hooks/kk.json` (Copilot loads
 * `.github/hooks/*.json` before user-level `~/.copilot/hooks/`). Hook
 * scripts live under the shared `.ai/kenkeep/hooks/copilot/` tree, and
 * skills install to Copilot's documented `.github/skills/` location. No
 * file is written outside the repository.
 *
 * `detectFromEnv` is intentionally omitted: Copilot exports no in-session
 * env var. Callers select the adapter via `--harness copilot` (CLI),
 * `--hint copilot` (skill helper), or `cliDefaultHarness: copilot` in
 * `config.yaml`.
 */
export const copilotAdapter: HarnessAdapter = {
  id: 'copilot',
  launchBinary: 'copilot',
  launchArgsPrefix: ['-p'],
  hooks: copilotHookSpecs,
  paths: copilotPaths,
  install: opts => installCopilot(opts),
  upgrade: opts => installCopilot(opts),
  parseTranscript: parseCopilotTranscript,
  renderTranscript: renderCopilotTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessCopilot(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildCopilotHarnessOpts(settings, role),
  doctorChecks: paths => copilotDoctorChecks(paths),
  // Copilot CLI has no native auto-memory feature today; return [] without
  // spawning a child. The interface stays uniform across adapters.
  listMemoryFiles: async () => [],
};
