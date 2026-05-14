/**
 * Back-compat re-export. The canonical Claude transcript parser now lives
 * at `src/harnesses/claude/transcript.ts`. Importing through this module
 * remains supported for existing call sites and tests.
 */
import type { RoleTaggedTranscript } from '../harnesses/types.js';

export type { RoleTaggedTranscript };
export { parseTranscriptJsonl, renderRoleTagged } from '../harnesses/claude/transcript.js';
