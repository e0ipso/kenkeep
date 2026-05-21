import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseCursorTranscript,
  renderCursorTranscript,
} from '../../../src/harnesses/cursor/transcript.js';

describe('parseCursorTranscript', () => {
  it('interleaves user and assistant text from Cursor agent JSONL', () => {
    const fixture = readFileSync(
      join(import.meta.dirname, '../../fixtures/cursor-transcript/sample.jsonl'),
      'utf8'
    );
    const parsed = parseCursorTranscript(fixture);
    expect(parsed.interleaved).toEqual([
      { role: 'user', text: 'How do I run tests?' },
      { role: 'agent', text: 'Run `npm test` from the repo root.' },
    ]);
    expect(renderCursorTranscript(parsed)).toContain('[USER]:');
    expect(renderCursorTranscript(parsed)).toContain('[AGENT]:');
  });
});
