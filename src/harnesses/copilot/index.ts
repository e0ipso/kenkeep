import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { copilotDoctorChecks } from './doctor.js';
import { runHeadlessCopilot } from './headless.js';
import { copilotHookSpecs } from './hook-spec.js';
import { copilotHome } from './hooks-config.js';
import { installCopilot } from './install.js';
import { buildCopilotHarnessOpts } from './opts.js';
import { parseCopilotTranscript, renderCopilotTranscript } from './transcript.js';

/**
 * GitHub Copilot CLI (`@github/copilot`) harness adapter. Copilot's
 * extension surface is a per-event JSON hook config under
 * `~/.copilot/hooks/`; the adapter aggregates every event handler into a
 * single `kk.json` document. Hook scripts live under `.copilot/kk-hooks/`
 * (a kenkeep-tool convention; Copilot does not read `.copilot/`), and
 * skills install to Copilot's documented `.github/skills/` location.
 *
 * `detectFromEnv` is intentionally omitted: Copilot exports no in-session
 * env var. Callers select the adapter via `--harness copilot` (CLI),
 * `--hint copilot` (skill helper), or `cliDefaultHarness: copilot` in
 * `config.yaml`.
 */
function copilotAdapterPaths(root: string): HarnessPaths {
  const dir = join(root, '.copilot');
  return {
    dir,
    hooksDir: join(dir, 'hooks'),
    skillsDir: join(root, '.github', 'skills'),
    settingsFile: join(copilotHome(), 'hooks', 'kk.json'),
  };
}

export const copilotAdapter: HarnessAdapter = {
  id: 'copilot',
  launchBinary: 'copilot',
  launchArgsPrefix: ['-p'],
  hooks: copilotHookSpecs,
  paths: copilotAdapterPaths,
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
