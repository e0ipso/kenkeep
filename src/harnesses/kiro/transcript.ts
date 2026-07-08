import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

/**
 * Parses a Kiro CLI session JSON file into the canonical role-tagged
 * transcript structure shared across harnesses.
 *
 * Kiro session files are stored at `~/.kiro/sessions/cli/<uuid>.json`.
 * The JSON shape is:
 *
 * ```json
 * {
 *   "session_id": "<uuid>",
 *   "session_state": {
 *     "conversation_metadata": {
 *       "user_turn_metadatas": [
 *         {
 *           "result": {
 *             "Ok": {
 *               "role": "assistant",
 *               "content": [{ "kind": "text", "data": "<text>" }]
 *             }
 *           }
 *         }
 *       ]
 *     }
 *   }
 * }
 * ```
 *
 * Each entry in `user_turn_metadatas` represents one user→assistant exchange.
 * The `result.Ok` carries the assistant's response. User turn text is not
 * stored directly in the session metadata; an empty placeholder `role: 'user'`
 * turn is emitted before each assistant turn so the interleaved structure
 * is valid for the proposal-extract pipeline.
 *
 * A missing or empty file yields `{ interleaved: [] }`. A JSON parse error
 * also returns `{ interleaved: [] }` without throwing.
 */
export function parseKiroTranscript(text: string): RoleTaggedTranscript {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { interleaved: [] };
  }

  const turns =
    (parsed as Record<string, unknown>)?.['session_state'] !== undefined
      ? (((
          ((parsed as Record<string, unknown>)['session_state'] as Record<string, unknown>)?.[
            'conversation_metadata'
          ] as Record<string, unknown>
        )?.['user_turn_metadatas'] as unknown[]) ?? [])
      : [];

  const interleaved: Array<{ role: 'user' | 'agent'; text: string }> = [];

  for (const turn of turns) {
    const ok =
      (turn as Record<string, unknown>)?.['result'] !== undefined
        ? ((turn as Record<string, unknown>)['result'] as Record<string, unknown>)?.['Ok']
        : undefined;

    if (!ok) continue;

    // Emit a placeholder user turn — user text is not stored in session metadata
    interleaved.push({ role: 'user', text: '' });

    const content = (ok as Record<string, unknown>)?.['content'];
    const textParts: string[] = Array.isArray(content)
      ? (content as Array<Record<string, unknown>>)
          .filter(c => c?.['kind'] === 'text')
          .map(c => String(c['data'] ?? ''))
      : [];

    interleaved.push({ role: 'agent', text: textParts.join('\n') });
  }

  return { interleaved };
}

/**
 * Renders a role-tagged transcript using the shared `[USER]:` / `[AGENT]:`
 * format. Kiro uses the same textual representation as every other harness,
 * so this is a thin pass-through over the shared renderer.
 */
export function renderKiroTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
