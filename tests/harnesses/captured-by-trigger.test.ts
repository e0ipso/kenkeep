import { describe, expect, it } from 'vitest';
import { CaptureTriggerSchema, type CaptureTrigger } from '../../src/lib/schemas.js';
import { CLAUDE_EVENT_TO_TRIGGER } from '../../src/harnesses/claude/hooks/kk-capture.js';
import { CURSOR_EVENT_TO_TRIGGER } from '../../src/harnesses/cursor/hooks/kk-capture.js';
import { CODEX_EVENT_TO_TRIGGER } from '../../src/harnesses/codex/hooks/kk-capture.js';
import { OPENCODE_EVENT_TO_TRIGGER } from '../../src/harnesses/opencode/hooks/kk-capture.js';
import { COPILOT_EVENT_TO_TRIGGER } from '../../src/harnesses/copilot/hooks/kk-capture.js';
import { KIRO_HOOK_SPECS } from '../../src/harnesses/kiro/hook-spec.js';
import { KIRO_CAPTURE_TRIGGER } from '../../src/harnesses/kiro/hooks/kk-capture.js';

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
  ];

  it.each(unknownDefaultCases)('$harness defaults an unknown native event to "stop"', ({ map }) => {
    expect(resolve(map, 'totally-unknown-event')).toBe('stop');
    expect(resolve(map, undefined)).toBe('stop');
  });

  it('kiro needs no event map: its one capture event already equals the trigger it records', () => {
    // Kiro is the only adapter without a KIRO_EVENT_TO_TRIGGER map, and that is
    // only sound while two things hold: kk-capture is registered on exactly one
    // native event, and that event's name is itself a canonical CaptureTrigger.
    // Registering a second capture event (sessionEnd, preCompact, ...) would
    // silently mislabel every capture as `stop`, so pin both facts here.
    const captureHooks = KIRO_HOOK_SPECS.filter(h => h.scriptPath === 'kk-capture.cjs');
    expect(captureHooks).toHaveLength(1);
    expect(captureHooks[0]?.event).toBe(KIRO_CAPTURE_TRIGGER);
    expect(CaptureTriggerSchema.safeParse(KIRO_CAPTURE_TRIGGER).success).toBe(true);
  });
});
