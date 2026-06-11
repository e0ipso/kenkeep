import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getHarness } from '../../src/harnesses/registry.js';
import { normalizeCursorConversationId } from '../../src/harnesses/cursor/session-id.js';
import { renderRoleTagged } from '../../src/lib/transcript-render.js';

/**
 * One representative two-turn transcript per adapter, expressed in that
 * adapter's native serialization. Each entry drives the adapter's own
 * `parseTranscript` through the registry, so adding a harness that parses
 * a text blob extends this matrix automatically.
 *
 * OpenCode is excluded here: its `parseTranscript` is a placeholder and the
 * real parser reads an on-disk storage tree, so it gets a targeted case
 * below.
 */
const textTranscriptCases: Array<{
  id: string;
  text: string;
  expected: Array<{ role: 'user' | 'agent'; text: string }>;
}> = [
  {
    id: 'claude',
    text: [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'How do I run tests?' } }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Run npm test from the repo root.' }],
        },
      }),
    ].join('\n'),
    expected: [
      { role: 'user', text: 'How do I run tests?' },
      { role: 'agent', text: 'Run npm test from the repo root.' },
    ],
  },
  {
    id: 'codex',
    text: [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'How do I run tests?' }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Run npm test from the repo root.' }],
        },
      }),
    ].join('\n'),
    expected: [
      { role: 'user', text: 'How do I run tests?' },
      { role: 'agent', text: 'Run npm test from the repo root.' },
    ],
  },
  {
    id: 'copilot',
    text: readFileSync(
      join(import.meta.dirname, '../fixtures/copilot-transcript/events.jsonl'),
      'utf8'
    ),
    expected: [
      { role: 'user', text: 'How do I run tests?' },
      { role: 'agent', text: 'Run npm test \nfrom the repo root.' },
    ],
  },
  {
    id: 'cursor',
    text: readFileSync(
      join(import.meta.dirname, '../fixtures/cursor-transcript/sample.jsonl'),
      'utf8'
    ),
    expected: [
      { role: 'user', text: 'How do I run tests?' },
      { role: 'agent', text: 'Run `npm test` from the repo root.' },
    ],
  },
];

describe('adapter.parseTranscript (parametrized over registered harnesses)', () => {
  it.each(textTranscriptCases)(
    '$id parses a two-turn exchange and renders role-tagged output',
    ({ id, text, expected }) => {
      const adapter = getHarness(id);
      const parsed = adapter.parseTranscript(text);
      expect(parsed.interleaved).toEqual(expected);
      const rendered = adapter.renderTranscript(parsed);
      expect(rendered).toContain('[USER]:');
      expect(rendered).toContain('[AGENT]:');
    }
  );
});

describe('codex transcript parsing edge cases', () => {
  const codex = getHarness('codex');

  it('dedupes task_complete echoes, concatenates text blocks, and skips meta/malformed lines', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lines = [
      JSON.stringify({
        type: 'session_meta',
        payload: { id: 'abc', started_at: '2025-01-01T00:00:00Z' },
      }),
      '',
      'not json at all',
      JSON.stringify({
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
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_complete', last_agent_message: 'first part\nsecond part' },
      }),
    ];
    expect(codex.parseTranscript(lines.join('\n')).interleaved).toEqual([
      { role: 'agent', text: 'first part\nsecond part' },
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('copilot transcript parsing edge cases', () => {
  const copilot = getHarness('copilot');

  it('concatenates chunked agent output sharing a grouping key and skips a truncated final line', () => {
    const lines = [
      JSON.stringify({
        type: 'user.message',
        data: { content: 'complete line' },
        id: 'u1',
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'assistant.message',
        data: { content: 'part one ' },
        id: 'a1',
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'turn-1',
      }),
      JSON.stringify({
        type: 'assistant.message',
        data: { content: 'part two' },
        id: 'a2',
        timestamp: '2026-06-05T00:00:03Z',
        parentId: 'turn-1',
      }),
      '{"type":"assistant.message","data":{"content":"trunc',
    ];
    expect(copilot.parseTranscript(lines.join('\n')).interleaved).toEqual([
      { role: 'user', text: 'complete line' },
      { role: 'agent', text: 'part one \npart two' },
    ]);
    expect(copilot.parseTranscript('').interleaved).toEqual([]);
  });

  it('rejects the old invented event shapes so the fixture reflects production', () => {
    // The pre-v1.0.61 parser keyed on invented type names and a data.role
    // fallback. Those shapes must no longer classify as turns.
    const inventedType = 'user' + 'Message';
    const inventedAgentType = 'agent' + 'Message';
    const lines = [
      JSON.stringify({
        type: inventedType,
        data: { role: 'user', content: 'invented user shape' },
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        type: inventedAgentType,
        data: { role: 'assistant', content: 'invented agent shape' },
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'a1',
      }),
      // A message event carrying only the removed data.role discriminator.
      JSON.stringify({
        type: 'message',
        data: { role: 'assistant', content: 'role-only shape' },
        timestamp: '2026-06-05T00:00:03Z',
        parentId: 'a1',
      }),
    ];
    expect(copilot.parseTranscript(lines.join('\n')).interleaved).toEqual([]);
  });
});

describe('claude transcript parsing edge cases', () => {
  const claude = getHarness('claude');

  it('keeps text blocks while ignoring tool_use/system blocks and malformed lines', () => {
    const jsonl = [
      'not json',
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Reading file...' },
            { type: 'tool_use', id: 'x', name: 'Read', input: {} },
          ],
        },
      }),
      JSON.stringify({ type: 'system', content: 'compaction notice' }),
    ].join('\n');
    expect(claude.parseTranscript(jsonl).interleaved).toEqual([
      { role: 'agent', text: 'Reading file...' },
    ]);
  });
});

describe('normalizeCursorConversationId (cursor session-id mapping)', () => {
  it('passes UUID v4 ids through and derives a stable UUID-shaped id otherwise', () => {
    const id = 'c6b62c6f-7ead-4fd6-9922-e952131177ff';
    expect(normalizeCursorConversationId(id)).toBe(id);
    const a = normalizeCursorConversationId('conv-abc123');
    expect(normalizeCursorConversationId('conv-abc123')).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('renderRoleTagged self-review-apply tagging', () => {
  it('leaves segments without the slash command unchanged', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: 'normal message' },
        { role: 'agent' as const, text: 'normal reply' },
      ],
    };
    expect(renderRoleTagged(t)).toBe('[USER]: normal message\n\n[AGENT]: normal reply');
  });

  it('tags both the trigger user segment and the following agent segment', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: '/self-review-apply feedback/round-2.xml' },
        { role: 'agent' as const, text: 'I worked through the comments...' },
      ],
    };
    expect(renderRoleTagged(t)).toBe(
      '[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml\n\n' +
        '[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]: I worked through the comments...'
    );
  });
});
