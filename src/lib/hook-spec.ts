/**
 * Back-compat re-export. The canonical Claude-Code hook list now lives in
 * `src/harnesses/claude/hook-spec.ts`; importing through this module
 * remains supported for the existing call sites and tests.
 */
import { CLAUDE_HOOK_SPECS } from '../harnesses/claude/hook-spec.js';
import type { HookEvent, HookSpec } from '../harnesses/types.js';

export type { HookEvent, HookSpec };
export const HOOK_SPECS: readonly HookSpec[] = CLAUDE_HOOK_SPECS;
