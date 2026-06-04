import { describe, expect, it } from 'vitest';
import {
  parseCopilotTranscript,
  renderCopilotTranscript,
} from '../../../src/harnesses/copilot/transcript.js';

describe('parseCopilotTranscript', () => {
  it('parses interleaved user and agent messages, skipping tool-call events', () => {
    const lines = [
      JSON.stringify({ type: 'sessionStart', data: {}, timestamp: '2026-06-05T00:00:00Z' }),
      JSON.stringify({
        type: 'userMessage',
        data: { role: 'user', content: 'first question' },
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'agentMessage',
        data: { role: 'assistant', content: 'first answer' },
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'a1',
      }),
      JSON.stringify({
        type: 'toolCall',
        data: { name: 'read' },
        timestamp: '2026-06-05T00:00:03Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'userMessage',
        data: { role: 'user', content: 'second question' },
        timestamp: '2026-06-05T00:00:04Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'agentMessage',
        data: { role: 'assistant', content: 'second answer' },
        timestamp: '2026-06-05T00:00:05Z',
        parentId: 'a2',
      }),
    ];
    const result = parseCopilotTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([
      { role: 'user', text: 'first question' },
      { role: 'agent', text: 'first answer' },
      { role: 'user', text: 'second question' },
      { role: 'agent', text: 'second answer' },
    ]);
  });

  it('concatenates chunked agent output that shares a parentId and role', () => {
    const lines = [
      JSON.stringify({
        type: 'agentMessage',
        data: { role: 'assistant', content: 'part one ' },
        timestamp: '2026-06-05T00:00:01Z',
        parentId: 'turn-1',
      }),
      JSON.stringify({
        type: 'agentMessage',
        data: { role: 'assistant', content: 'part two' },
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'turn-1',
      }),
    ];
    const result = parseCopilotTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([{ role: 'agent', text: 'part one \npart two' }]);
  });

  it('falls back to data.role and data.text when type and content are absent', () => {
    const lines = [
      JSON.stringify({
        data: { role: 'user', text: 'hi from text field' },
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        data: { role: 'assistant', text: 'hello back' },
        timestamp: '2026-06-05T00:00:02Z',
        parentId: null,
      }),
    ];
    const result = parseCopilotTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([
      { role: 'user', text: 'hi from text field' },
      { role: 'agent', text: 'hello back' },
    ]);
  });

  it('skips a truncated final JSON line without throwing', () => {
    const lines = [
      JSON.stringify({
        type: 'userMessage',
        data: { role: 'user', content: 'complete line' },
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      '{"type":"agentMessage","data":{"role":"assistant","content":"trunc',
    ];
    const result = parseCopilotTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([{ role: 'user', text: 'complete line' }]);
  });

  it('returns an empty transcript for empty or whitespace-only input', () => {
    expect(parseCopilotTranscript('').interleaved).toEqual([]);
    expect(parseCopilotTranscript('   \n  \n').interleaved).toEqual([]);
  });

  it('renderCopilotTranscript wraps the shared role-tagged renderer', () => {
    const out = renderCopilotTranscript({
      interleaved: [
        { role: 'user', text: 'hi' },
        { role: 'agent', text: 'hello' },
      ],
    });
    expect(out).toBe('[USER]: hi\n\n[AGENT]: hello');
  });
});
