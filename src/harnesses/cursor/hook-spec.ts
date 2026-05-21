import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Cursor adapter. Native Cursor event
 * names are camelCase and are written to `.cursor/hooks.json` as-is (no
 * translation to Claude PascalCase).
 */
export const cursorHookSpecs: readonly HookSpec[] = [
  { event: 'stop', scriptPath: 'kb-capture.cjs' },
  { event: 'sessionEnd', scriptPath: 'kb-capture.cjs' },
  { event: 'sessionEnd', scriptPath: 'kb-lint-tick.cjs' },
  { event: 'preCompact', scriptPath: 'kb-capture.cjs' },
  { event: 'sessionStart', scriptPath: 'kb-session-start.cjs' },
  { event: 'sessionStart', scriptPath: 'kb-proposal-drain.cjs' },
];
