import { describe, expect, it } from 'vitest';
import { normalizeCursorConversationId } from '../../../src/harnesses/cursor/session-id.js';

describe('normalizeCursorConversationId', () => {
  it('passes through lowercase UUID v4 ids', () => {
    const id = 'c6b62c6f-7ead-4fd6-9922-e952131177ff';
    expect(normalizeCursorConversationId(id)).toBe(id);
  });

  it('derives a stable UUID-shaped id from non-UUID conversation ids', () => {
    const a = normalizeCursorConversationId('conv-abc123');
    const b = normalizeCursorConversationId('conv-abc123');
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
