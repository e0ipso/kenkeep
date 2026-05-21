import { createHash } from 'node:crypto';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalizes Cursor `conversation_id` values to UUID v4 for session logs.
 * Passes through valid UUID v4; otherwise derives a deterministic id.
 */
export function normalizeCursorConversationId(conversationId: string): string {
  if (UUID_V4_RE.test(conversationId)) return conversationId.toLowerCase();
  const hash = createHash('sha256').update(`cursor:${conversationId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
