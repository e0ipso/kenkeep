const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Grok Build session ids are UUIDv7 (sometimes other UUID versions). Keep the
 * filename/idempotency safety of UUID syntax without requiring version 4.
 */
export function assertValidGrokSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('session_id must be a non-empty string');
  }
  if (!UUID_RE.test(sessionId)) {
    throw new Error(`session_id "${sessionId}" is not a UUID`);
  }
  return sessionId.toLowerCase();
}
