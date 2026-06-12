import { join } from 'node:path';
import type { EffectiveSettings } from '../../lib/settings.js';
import type { HarnessAdapter, HarnessPaths, ModelChoiceRole } from '../types.js';
import { cursorDoctorChecks } from './doctor.js';
import { runHeadlessCursor } from './headless.js';
import { cursorHookSpecs } from './hook-spec.js';
import { installCursor } from './install.js';
import { buildCursorHarnessOpts } from './opts.js';
import { parseCursorTranscript, renderCursorTranscript } from './transcript.js';

/**
 * Returns true when the process appears to be running inside a Cursor
 * agent session. cursor-agent (verified against 2026.06 builds) exports
 * `CURSOR_AGENT=1` to shell tools — it never sets `CURSOR_VERSION` in the
 * environment (that name exists only as a hook stdin JSON field), so the
 * old check made detection dead and plain `npx kenkeep <launcher>` from a
 * Cursor session fell through to the claude fallback. `CURSOR_VERSION` is
 * kept as a secondary signal for hosts that do export it. Claude sessions
 * are excluded because the claude adapter is checked first when
 * `CLAUDECODE=1` (registry order).
 */
function detectCursorFromEnv(env: NodeJS.ProcessEnv): boolean {
  if (env['CURSOR_AGENT'] === '1') return true;
  const version = env['CURSOR_VERSION'];
  return typeof version === 'string' && version.length > 0;
}

function cursorPaths(root: string): HarnessPaths {
  const dir = join(root, '.cursor');
  return {
    dir,
    skillsDir: join(dir, 'skills'),
    hooksDir: join(dir, 'hooks'),
    settingsFile: join(dir, 'hooks.json'),
  };
}

export const cursorAdapter: HarnessAdapter = {
  id: 'cursor',
  launchBinary: 'agent',
  launchArgsPrefix: ['-p'],
  hooks: cursorHookSpecs,
  paths: cursorPaths,
  install: opts => installCursor(opts),
  upgrade: opts => installCursor(opts),
  parseTranscript: parseCursorTranscript,
  renderTranscript: renderCursorTranscript,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessCursor(promptBody, stdin, schema, opts ?? {}),
  buildHarnessOpts: (settings: EffectiveSettings, role: ModelChoiceRole) =>
    buildCursorHarnessOpts(settings, role),
  doctorChecks: paths => cursorDoctorChecks(paths),
  detectFromEnv: detectCursorFromEnv,
  listMemoryFiles: async () => [],
};
