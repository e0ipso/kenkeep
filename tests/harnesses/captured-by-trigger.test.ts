import { describe, expect, it } from 'vitest';
import type { CaptureTrigger } from '../../src/lib/schemas.js';
import { CLAUDE_EVENT_TO_TRIGGER } from '../../src/harnesses/claude/hooks/kk-capture.js';
import { CURSOR_EVENT_TO_TRIGGER } from '../../src/harnesses/cursor/hooks/kk-capture.js';
import { CODEX_EVENT_TO_TRIGGER } from '../../src/harnesses/codex/hooks/kk-capture.js';
import { OPENCODE_EVENT_TO_TRIGGER } from '../../src/harnesses/opencode/hooks/kk-capture.js';
import { COPILOT_EVENT_TO_TRIGGER } from '../../src/harnesses/copilot/hooks/kk-capture.js';
import { GROK_EVENT_TO_TRIGGER } from '../../src/harnesses/grok/hooks/kk-capture.js';

/**
 * Each adapter owns the native→canonical `captured_by` mapping for its own
 * harness. The shared capture entry point no longer translates Claude event
 * names, so these maps are the single source of truth for what trigger each
 * harness records. Every hook resolves with `MAP[event] ?? 'stop'`, so an
 * unrecognized native event falls back to `stop`.
 */
function resolve(map: Record<string, CaptureTrigger>, event: string | undefined): CaptureTrigger {
  return (event !== undefined ? map[event] : undefined) ?? 'stop';
}

const cases: Array<{
  harness: string;
  map: Record<string, CaptureTrigger>;
  event: string;
  expected: CaptureTrigger;
}> = [
  { harness: 'claude', map: CLAUDE_EVENT_TO_TRIGGER, event: 'Stop', expected: 'stop' },
  {
    harness: 'claude',
    map: CLAUDE_EVENT_TO_TRIGGER,
    event: 'SessionEnd',
    expected: 'session_end',
  },
  {
    harness: 'claude',
    map: CLAUDE_EVENT_TO_TRIGGER,
    event: 'PreCompact',
    expected: 'pre_compact',
  },
  { harness: 'cursor', map: CURSOR_EVENT_TO_TRIGGER, event: 'stop', expected: 'stop' },
  {
    harness: 'cursor',
    map: CURSOR_EVENT_TO_TRIGGER,
    event: 'sessionEnd',
    expected: 'session_end',
  },
  {
    harness: 'cursor',
    map: CURSOR_EVENT_TO_TRIGGER,
    event: 'preCompact',
    expected: 'pre_compact',
  },
  { harness: 'codex', map: CODEX_EVENT_TO_TRIGGER, event: 'Stop', expected: 'stop' },
  {
    harness: 'opencode',
    map: OPENCODE_EVENT_TO_TRIGGER,
    event: 'session.idle',
    expected: 'stop',
  },
  { harness: 'copilot', map: COPILOT_EVENT_TO_TRIGGER, event: 'agentStop', expected: 'stop' },
  {
    harness: 'copilot',
    map: COPILOT_EVENT_TO_TRIGGER,
    event: 'sessionEnd',
    expected: 'session_end',
  },
  { harness: 'grok', map: GROK_EVENT_TO_TRIGGER, event: 'Stop', expected: 'stop' },
  {
    harness: 'grok',
    map: GROK_EVENT_TO_TRIGGER,
    event: 'SessionEnd',
    expected: 'session_end',
  },
  {
    harness: 'grok',
    map: GROK_EVENT_TO_TRIGGER,
    event: 'PreCompact',
    expected: 'pre_compact',
  },
];

describe('adapter-owned captured_by trigger mapping', () => {
  it.each(cases)('$harness maps native "$event" to "$expected"', ({ map, event, expected }) => {
    expect(map[event]).toBe(expected);
    expect(resolve(map, event)).toBe(expected);
  });

  const unknownDefaultCases: Array<{ harness: string; map: Record<string, CaptureTrigger> }> = [
    { harness: 'claude', map: CLAUDE_EVENT_TO_TRIGGER },
    { harness: 'cursor', map: CURSOR_EVENT_TO_TRIGGER },
    { harness: 'codex', map: CODEX_EVENT_TO_TRIGGER },
    { harness: 'opencode', map: OPENCODE_EVENT_TO_TRIGGER },
    { harness: 'copilot', map: COPILOT_EVENT_TO_TRIGGER },
    { harness: 'grok', map: GROK_EVENT_TO_TRIGGER },
  ];

  it.each(unknownDefaultCases)('$harness defaults an unknown native event to "stop"', ({ map }) => {
    expect(resolve(map, 'totally-unknown-event')).toBe('stop');
    expect(resolve(map, undefined)).toBe('stop');
  });
});
