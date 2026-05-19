import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the OpenCode adapter. The plugin shim
 * subscribes to OpenCode's native `event` bus and dispatches to these
 * scripts based on the event type. Names are OpenCode-native
 * (`session.idle`, `session.created`); no translation to Claude/Codex
 * canonical names happens.
 */
export const openCodeHookSpecs: readonly HookSpec[] = [
  { event: 'session.idle', scriptPath: 'kb-capture.cjs' },
  { event: 'session.idle', scriptPath: 'kb-lint-tick.cjs' },
  { event: 'session.created', scriptPath: 'kb-session-start.cjs' },
  { event: 'session.created', scriptPath: 'kb-proposal-drain.cjs', async: true },
];
