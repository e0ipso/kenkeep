/**
 * Parses a Grok Build `chat_history.jsonl` stream into the canonical
 * role-tagged transcript. One JSON object per line. Message types of
 * interest:
 *   - `type: "user"` — real user turns (`prompt_index` or `<user_query>`).
 *   - `type: "assistant"` — assistant text at `content` (string).
 * Synthetic reminders, system prompts, reasoning, and tool results are
 * skipped. Malformed lines never throw.
 */
import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

const USER_QUERY_RE = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/i;

interface GrokHistoryMessage {
  type?: string;
  content?: unknown;
  synthetic_reason?: unknown;
  prompt_index?: unknown;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (block): block is { type?: string; text?: string } => !!block && typeof block === 'object'
    )
    .map(block => (typeof block.text === 'string' ? block.text : ''))
    .filter(s => s.length > 0)
    .join('\n');
}

function unwrapUserQuery(text: string): string {
  const match = USER_QUERY_RE.exec(text);
  if (match?.[1] !== undefined) return match[1].trim();
  return text;
}

function isRealUserTurn(msg: GrokHistoryMessage, text: string): boolean {
  if (msg.type !== 'user') return false;
  if (typeof msg.synthetic_reason === 'string' && msg.synthetic_reason.length > 0) {
    return false;
  }
  if (typeof msg.prompt_index === 'number') return true;
  return USER_QUERY_RE.test(text);
}

export function parseGrokTranscript(text: string): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let msg: GrokHistoryMessage;
    try {
      msg = JSON.parse(line) as GrokHistoryMessage;
    } catch {
      continue;
    }
    if (msg.type === 'user') {
      const raw = extractText(msg.content);
      if (!isRealUserTurn(msg, raw)) continue;
      const body = unwrapUserQuery(raw);
      if (body.length > 0) out.interleaved.push({ role: 'user', text: body });
      continue;
    }
    if (msg.type === 'assistant') {
      const body = extractText(msg.content).trim();
      if (body.length > 0) out.interleaved.push({ role: 'agent', text: body });
    }
  }
  return out;
}

export function renderGrokTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
