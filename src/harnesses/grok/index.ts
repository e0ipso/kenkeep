import { join } from 'node:path';
import { sharedHarnessHooksDirForRoot } from '../../lib/shared-hooks.js';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { grokDoctorChecks } from './doctor.js';
import { runHeadlessGrok } from './headless.js';
import { grokHookSpecs } from './hook-spec.js';
import { installGrok } from './install.js';
import { buildGrokHarnessOpts } from './opts.js';
import { parseGrokTranscript, renderGrokTranscript } from './transcript.js';

/**
 * Returns true when this process is inside a Grok Build session.
 * `GROK_AGENT=1` is exported in the agent shell and on hook subprocesses.
 */
function detectGrokFromEnv(env: NodeJS.ProcessEnv): boolean {
  return env['GROK_AGENT'] === '1';
}

function grokAdapterPaths(root: string): HarnessPaths {
  const dir = join(root, '.grok');
  return {
    dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'grok'),
    skillsDir: join(dir, 'skills'),
    settingsFile: join(dir, 'hooks', 'kk.json'),
  };
}

export const grokAdapter: HarnessAdapter = {
  id: 'grok',
  launchBinary: 'grok',
  launchArgsPrefix: ['-p'],
  hooks: grokHookSpecs,
  paths: grokAdapterPaths,
  install: opts => installGrok(opts),
  upgrade: opts => installGrok(opts),
  parseTranscript: parseGrokTranscript,
  renderTranscript: renderGrokTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessGrok(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildGrokHarnessOpts(settings, role),
  doctorChecks: paths => grokDoctorChecks(paths),
  detectFromEnv: detectGrokFromEnv,
  // Owner policy and Grok defaults: vendor memory stays off. Do not discover
  // ~/.grok/memory files.
  listMemoryFiles: async () => [],
};
