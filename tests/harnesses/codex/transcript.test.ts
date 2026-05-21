import { describe, expect, it, vi } from 'vitest';
import {
  parseCodexTranscript,
  renderCodexTranscript,
} from '../../../src/harnesses/codex/transcript.js';

describe('parseCodexTranscript', () => {
  it('parses one of each line type in order, ignoring session_meta', () => {
    const lines = [
      JSON.stringify({
        type: 'session_meta',
        payload: { id: 'abc', started_at: '2025-01-01T00:00:00Z' },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'hello' }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'hi there' }],
        },
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'user_message', message: 'second turn' },
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_complete', last_agent_message: 'done with second turn' },
      }),
    ];
    const result = parseCodexTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'agent', text: 'hi there' },
      { role: 'user', text: 'second turn' },
      { role: 'agent', text: 'done with second turn' },
    ]);
  });

  it('dedupes task_complete echoes that match the previous agent turn', () => {
    const lines = [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'final answer' }],
        },
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_complete', last_agent_message: 'final answer' },
      }),
    ];
    const result = parseCodexTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([{ role: 'agent', text: 'final answer' }]);
  });

  it('concatenates multiple _text blocks in a single response_item', () => {
    const line = JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'output_text', text: 'first part' },
          { type: 'output_text', text: 'second part' },
          { type: 'tool_call', text: 'ignored' },
        ],
      },
    });
    const result = parseCodexTranscript(line);
    expect(result.interleaved).toEqual([{ role: 'agent', text: 'first part\nsecond part' }]);
  });

  it('skips empty lines and malformed JSON lines without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lines = [
      '',
      '   ',
      'not json at all',
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'still parsed' }],
        },
      }),
    ];
    const result = parseCodexTranscript(lines.join('\n'));
    expect(result.interleaved).toEqual([{ role: 'user', text: 'still parsed' }]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renderCodexTranscript wraps the shared role-tagged renderer', () => {
    const out = renderCodexTranscript({
      interleaved: [
        { role: 'user', text: 'hi' },
        { role: 'agent', text: 'hello' },
      ],
    });
    expect(out).toBe('[USER]: hi\n\n[AGENT]: hello');
  });
});
