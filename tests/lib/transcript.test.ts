import { describe, expect, it } from 'vitest';
import { parseTranscriptJsonl } from '../../src/harnesses/claude/transcript.js';
import { renderRoleTagged } from '../../src/lib/transcript-render.js';

describe('parseTranscriptJsonl', () => {
  it('extracts user and assistant text from JSONL', () => {
    const jsonl = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' } }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] },
      }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Use bravo_pii cache.' } }),
    ].join('\n');

    const parsed = parseTranscriptJsonl(jsonl);
    expect(parsed.interleaved.map(s => s.text)).toEqual([
      'Hello',
      'Hi there',
      'Use bravo_pii cache.',
    ]);
    expect(parsed.interleaved.map(s => s.role)).toEqual(['user', 'agent', 'user']);
  });

  it('ignores tool_use and system blocks but keeps text blocks', () => {
    const jsonl = [
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

    const parsed = parseTranscriptJsonl(jsonl);
    expect(parsed.interleaved).toEqual([{ role: 'agent', text: 'Reading file...' }]);
  });

  it('skips malformed JSON lines silently', () => {
    const jsonl = [
      'not json',
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'ok' } }),
      '',
    ].join('\n');
    const parsed = parseTranscriptJsonl(jsonl);
    expect(parsed.interleaved).toEqual([{ role: 'user', text: 'ok' }]);
  });

  it('renders role-tagged transcript with USER / AGENT prefixes', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: 'hi' },
        { role: 'agent' as const, text: 'hello' },
      ],
    };
    expect(renderRoleTagged(t)).toBe('[USER]: hi\n\n[AGENT]: hello');
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
    const rendered = renderRoleTagged(t);
    expect(rendered).toBe(
      '[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml\n\n' +
        '[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]: I worked through the comments...'
    );
  });

  it('tags only the user segment when no following segment exists', () => {
    const t = {
      interleaved: [{ role: 'user' as const, text: '/self-review-apply feedback/round-2.xml' }],
    };
    expect(renderRoleTagged(t)).toBe(
      '[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml'
    );
  });

  it('tags only the user segment when the next segment is another user segment', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: '/self-review-apply feedback/round-2.xml' },
        { role: 'user' as const, text: 'also check the tests' },
      ],
    };
    expect(renderRoleTagged(t)).toBe(
      '[USER /self-review-apply feedback/round-2.xml]: /self-review-apply feedback/round-2.xml\n\n' +
        '[USER]: also check the tests'
    );
  });

  it('does not tag when the trigger is embedded in prose', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: 'I will run /self-review-apply foo.xml later today' },
        { role: 'agent' as const, text: 'sure' },
      ],
    };
    expect(renderRoleTagged(t)).toBe(
      '[USER]: I will run /self-review-apply foo.xml later today\n\n[AGENT]: sure'
    );
  });

  it('tags trigger segments with leading and trailing whitespace and preserves the body', () => {
    const t = {
      interleaved: [
        { role: 'user' as const, text: '  /self-review-apply x.xml\n' },
        { role: 'agent' as const, text: 'done' },
      ],
    };
    expect(renderRoleTagged(t)).toBe(
      '[USER /self-review-apply x.xml]:   /self-review-apply x.xml\n\n\n' +
        '[AGENT NARRATION OF SELF-REVIEW x.xml]: done'
    );
  });
});
