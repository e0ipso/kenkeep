import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

/**
 * Placeholder text-mode parser kept for the `HarnessAdapter` contract.
 * OpenCode sources its transcript from `opencode export` inside the capture
 * hook, not from a text blob, so this returns an empty transcript.
 */
export function parseOpenCodeTranscriptText(_text: string): RoleTaggedTranscript {
  return { interleaved: [] };
}

export function renderOpenCodeTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
