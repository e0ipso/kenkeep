const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Codex session ids are UUID-shaped but not guaranteed to be UUID v4. Keep the
 * filename/idempotency safety from UUID syntax while accepting newer ids such
 * as UUIDv7.
 */
export function assertValidCodexSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('session_id must be a non-empty string');
  }
  if (!UUID_RE.test(sessionId)) {
    throw new Error(`session_id "${sessionId}" is not a UUID`);
  }
  return sessionId.toLowerCase();
}
