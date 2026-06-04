/**
 * Parses a GitHub Copilot CLI `events.jsonl` stream into the canonical
 * role-tagged transcript structure shared across harnesses.
 *
 * Copilot writes one JSON object per line under
 * `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl`. The
 * envelope is `{ type, data, id, timestamp, parentId }`. The exact `type`
 * strings for user and agent message events are not pinned in public docs,
 * so the parser is defensive: it accepts the documented `userMessage` /
 * `agentMessage` type names and also falls back to `data.role` of `'user'`
 * or `'assistant'`. Message text comes from `data.content`, falling back to
 * `data.text`.
 *
 * Chunked streaming output (several events sharing a `parentId` and role) is
 * concatenated into a single turn. Independent events (different `parentId`)
 * become separate turns even when they share a role. Lines that fail
 * `JSON.parse` (including a truncated final line) are skipped silently, so a
 * partially written file never crashes capture. A missing or empty file
 * yields `{ interleaved: [] }`.
 */
import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

interface CopilotEvent {
  type?: string;
  timestamp?: string;
  parentId?: string | null;
  data?: {
    role?: string;
    content?: unknown;
    text?: unknown;
  };
}

type Role = 'user' | 'agent';

interface ParsedTurn {
  role: Role;
  text: string;
  timestamp: string;
  parentId: string | null;
  order: number;
}

function classify(event: CopilotEvent): Role | null {
  if (event.type === 'userMessage') return 'user';
  if (event.type === 'agentMessage') return 'agent';
  const role = event.data?.role;
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'agent';
  return null;
}

function messageText(event: CopilotEvent): string {
  const content = event.data?.content;
  if (typeof content === 'string' && content.length > 0) return content;
  const text = event.data?.text;
  if (typeof text === 'string' && text.length > 0) return text;
  return '';
}

export function parseCopilotTranscript(text: string): RoleTaggedTranscript {
  const turns: ParsedTurn[] = [];
  let order = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let event: CopilotEvent;
    try {
      event = JSON.parse(line) as CopilotEvent;
    } catch {
      // Skip malformed or truncated lines without throwing.
      continue;
    }
    const role = classify(event);
    if (role === null) continue;
    const body = messageText(event);
    if (body.length === 0) continue;
    turns.push({
      role,
      text: body,
      timestamp: typeof event.timestamp === 'string' ? event.timestamp : '',
      parentId: typeof event.parentId === 'string' ? event.parentId : null,
      order: order++,
    });
  }

  // Stable sort by timestamp, falling back to original line order so events
  // with equal or missing timestamps keep their stream order.
  turns.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
    return a.order - b.order;
  });

  const out: RoleTaggedTranscript = { interleaved: [] };
  let current: { role: Role; parentId: string | null; texts: string[] } | null = null;
  for (const turn of turns) {
    const sameGroup =
      current !== null &&
      current.role === turn.role &&
      turn.parentId !== null &&
      current.parentId === turn.parentId;
    if (sameGroup) {
      current!.texts.push(turn.text);
      continue;
    }
    if (current !== null) {
      out.interleaved.push({ role: current.role, text: current.texts.join('\n') });
    }
    current = { role: turn.role, parentId: turn.parentId, texts: [turn.text] };
  }
  if (current !== null) {
    out.interleaved.push({ role: current.role, text: current.texts.join('\n') });
  }

  return out;
}

/**
 * Renders a role-tagged transcript using the shared `[USER]:` / `[AGENT]:`
 * format. Copilot uses the same textual representation as every other
 * harness, so this is a thin pass-through over the shared renderer.
 */
export function renderCopilotTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
