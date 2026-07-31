import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

/** Narrowing helper: a non-null, non-array object usable as a property bag. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Returns the `user_turn_metadatas` array of a parsed Kiro session document,
 * or `[]` for any shape that is not the expected one. Shared with
 * `extractKiroReads` in `../read-extract.ts` so the two consumers of the Kiro
 * session format cannot drift apart.
 *
 * Every step is guarded: a non-object at any level, or a
 * `user_turn_metadatas` that is not an array, yields `[]` rather than
 * throwing. Capture must never fail because a session file has an
 * unexpected shape.
 */
export function kiroSessionTurns(parsed: unknown): unknown[] {
  const metadatas = asRecord(
    asRecord(asRecord(parsed)?.['session_state'])?.['conversation_metadata']
  )?.['user_turn_metadatas'];
  return Array.isArray(metadatas) ? metadatas : [];
}

/**
 * Returns the assistant text of one `user_turn_metadatas` entry, joining the
 * `kind: 'text'` content blocks with newlines. Non-text blocks, non-string
 * `data`, and unexpected shapes contribute nothing.
 */
export function kiroTurnAssistantText(turn: unknown): string | undefined {
  const ok = asRecord(asRecord(turn)?.['result'])?.['Ok'];
  if (ok === undefined) return undefined;
  const content = asRecord(ok)?.['content'];
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    const record = asRecord(block);
    if (record?.['kind'] !== 'text') continue;
    const data = record['data'];
    if (typeof data === 'string') parts.push(data);
  }
  return parts.join('\n');
}

/**
 * Parses a Kiro CLI session JSON file into the canonical role-tagged
 * transcript structure shared across harnesses.
 *
 * Kiro session files are stored at `~/.kiro/sessions/cli/<session-id>.json`.
 * The JSON shape is:
 *
 * ```json
 * {
 *   "session_id": "<id>",
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
 * turn is emitted before each assistant turn so the interleaved structure is
 * valid for the proposal-extract pipeline.
 *
 * Total function: a missing, empty, unparseable, or structurally unexpected
 * document yields `{ interleaved: [] }` and never throws. Capture depends on
 * this — a session file kenkeep cannot understand must degrade to an empty
 * transcript, not abort the hook.
 */
export function parseKiroTranscript(text: string): RoleTaggedTranscript {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { interleaved: [] };
  }

  const interleaved: Array<{ role: 'user' | 'agent'; text: string }> = [];
  for (const turn of kiroSessionTurns(parsed)) {
    const agentText = kiroTurnAssistantText(turn);
    if (agentText === undefined) continue;
    // NOTE: Kiro's session JSON stores only the assistant's response in
    // user_turn_metadatas. The user's original message text is referenced only
    // by UUID in message_ids and is not present in this structure. An empty
    // placeholder user turn is emitted so the interleaved shape remains valid,
    // but ALL Kiro session captures will have blank user turns. This degrades
    // proposal-extract quality because user intent is absent from the
    // transcript. Lifting it requires a Kiro session format that persists user
    // message bodies.
    interleaved.push({ role: 'user', text: '' });
    interleaved.push({ role: 'agent', text: agentText });
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
