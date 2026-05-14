/**
 * Back-compat re-export. The canonical implementation now lives in
 * `src/harnesses/claude/hooks-config.ts`. Existing tests and callers can
 * keep importing from here.
 */
import type { HookEvent, HookSpec } from '../harnesses/types.js';

export type { HookEvent, HookSpec };
export { writeClaudeHookConfig } from '../harnesses/claude/hooks-config.js';
