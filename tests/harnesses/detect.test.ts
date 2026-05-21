import { describe, expect, it } from 'vitest';
import {
  detectHarnessFromEnv,
  resolveActiveHarness,
  resolveWithHint,
} from '../../src/harnesses/detect.js';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import { cursorAdapter } from '../../src/harnesses/cursor/index.js';

describe('detectHarnessFromEnv', () => {
  it('returns the claude adapter when CLAUDECODE=1', () => {
    const adapter = detectHarnessFromEnv({ CLAUDECODE: '1' });
    expect(adapter?.id).toBe('claude');
  });

  it('does not return claude when only CLAUDE_PROJECT_DIR is set', () => {
    const adapter = detectHarnessFromEnv({ CLAUDE_PROJECT_DIR: '/repo' });
    expect(adapter).toBeNull();
  });

  it('returns the cursor adapter when CURSOR_VERSION is set without CLAUDECODE', () => {
    const adapter = detectHarnessFromEnv({
      CURSOR_VERSION: '1.0.0',
      CLAUDE_PROJECT_DIR: '/repo',
    });
    expect(adapter?.id).toBe('cursor');
  });

  it('prefers claude over cursor when CLAUDECODE=1 and CURSOR_VERSION are both set', () => {
    const adapter = detectHarnessFromEnv({ CLAUDECODE: '1', CURSOR_VERSION: '1.0.0' });
    expect(adapter?.id).toBe('claude');
  });

  it('returns null when no harness env signal is present', () => {
    const adapter = detectHarnessFromEnv({ HOME: '/root', PATH: '/usr/bin' });
    expect(adapter).toBeNull();
  });

  it('treats an empty CLAUDE_PROJECT_DIR as no signal', () => {
    const adapter = detectHarnessFromEnv({ CLAUDE_PROJECT_DIR: '' });
    expect(adapter).toBeNull();
  });

  it('ignores CLAUDECODE values other than "1"', () => {
    const adapter = detectHarnessFromEnv({ CLAUDECODE: '0' });
    expect(adapter).toBeNull();
  });
});

describe('resolveActiveHarness', () => {
  it('returns the adapter named by the explicit --harness flag', () => {
    const adapter = resolveActiveHarness({ flag: 'claude', env: {} });
    expect(adapter).toBe(claudeAdapter);
  });

  it('returns the cursor adapter when --harness cursor is passed', () => {
    const adapter = resolveActiveHarness({ flag: 'cursor', env: {} });
    expect(adapter).toBe(cursorAdapter);
  });

  it('throws when --harness names an unregistered adapter', () => {
    expect(() => resolveActiveHarness({ flag: 'not-real', env: {} })).toThrow(
      /Unsupported harness 'not-real'/
    );
  });

  it('the --harness flag takes precedence over env detection', () => {
    const adapter = resolveActiveHarness({
      flag: 'claude',
      env: { CLAUDECODE: '1' },
    });
    expect(adapter).toBe(claudeAdapter);
  });

  it('prefers env detection over the CLI default when no flag is given', () => {
    const adapter = resolveActiveHarness({
      env: { CLAUDECODE: '1' },
      cliDefault: 'definitely-not-registered',
    });
    expect(adapter).toBe(claudeAdapter);
  });

  it('uses the CLI default when env detection finds nothing (plain-shell CLI invocation)', () => {
    const adapter = resolveActiveHarness({
      env: {},
      cliDefault: 'claude',
    });
    expect(adapter.id).toBe('claude');
  });

  it('falls back to the first registered harness when nothing else matches', () => {
    const adapter = resolveActiveHarness({ env: {} });
    expect(adapter.id).toBe('claude');
  });

  it('accepts cursor as cliDefaultHarness when registered', () => {
    const adapter = resolveActiveHarness({ env: {}, cliDefault: 'cursor' });
    expect(adapter).toBe(cursorAdapter);
  });
});

describe('resolveWithHint', () => {
  it('hint wins over env when the hint is a registered id', () => {
    const adapter = resolveWithHint({ CLAUDECODE: '1' }, 'codex');
    expect(adapter.id).toBe('codex');
  });

  it('env wins when hint is absent', () => {
    const adapter = resolveWithHint({ CLAUDECODE: '1' });
    expect(adapter.id).toBe('claude');
  });

  it('configDefault wins when both hint and env are absent', () => {
    const adapter = resolveWithHint({}, undefined, 'codex');
    expect(adapter.id).toBe('codex');
  });

  it('bogus hint falls through to env detection', () => {
    const adapter = resolveWithHint({ CLAUDECODE: '1' }, 'definitely-not-registered');
    expect(adapter.id).toBe('claude');
  });

  it('bogus hint with no env and no configDefault throws', () => {
    expect(() => resolveWithHint({}, 'definitely-not-registered')).toThrow(
      /Pass --hint <id> or set cliDefaultHarness/
    );
  });

  it('throws when nothing resolves, naming --hint and cliDefaultHarness', () => {
    expect(() => resolveWithHint({})).toThrow(/--hint <id>/);
    expect(() => resolveWithHint({})).toThrow(/cliDefaultHarness/);
  });
});
