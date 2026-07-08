import type { HookSpec } from '../types.js';

/**
 * Kiro CLI v1 ships no session lifecycle hook events (no sessionStart /
 * sessionEnd equivalent). The hook system fires on file:afterSave,
 * chat:message, and command:executed — none of which map to kenkeep's
 * capture / session-start injection surface.
 *
 * TODO: when Kiro exposes a session lifecycle event (e.g. `session:start`,
 * `session:end`), wire kk-session-start.cjs, kk-capture.cjs,
 * kk-proposal-drain.cjs, and kk-lint-tick.cjs here.
 */
export const KIRO_HOOK_SPECS: readonly HookSpec[] = [];
