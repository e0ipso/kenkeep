import type { HarnessAdapter } from '../types.js';
import { claudeDoctorChecks } from './doctor.js';
import { runHeadlessClaude } from './headless.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { installClaude } from './install.js';
import { parseTranscriptJsonl, renderRoleTagged } from './transcript.js';

/**
 * Claude Code harness adapter. Bundles the hook specs, transcript parser,
 * headless runner, install logic, and doctor checks that are specific to
 * Claude Code into a single plug.
 *
 * Register additional harnesses (Codex, OpenCode, …) by adding a sibling
 * directory under `src/harnesses/` and entering it in the registry.
 */
export const claudeAdapter: HarnessAdapter = {
  id: 'claude',
  hooks: CLAUDE_HOOK_SPECS,
  install: opts => installClaude(opts),
  upgrade: opts => installClaude(opts),
  parseTranscript: parseTranscriptJsonl,
  renderTranscript: renderRoleTagged,
  runHeadless: (promptBody, stdin, schema, opts) =>
    runHeadlessClaude(promptBody, stdin, schema, opts ?? {}),
  doctorChecks: paths => claudeDoctorChecks(paths),
};
