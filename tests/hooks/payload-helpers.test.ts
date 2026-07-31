import { describe, expect, it } from 'vitest';
import { hookStartCwd, payloadString } from '../../src/lib/hook-entry.js';

/**
 * Every hook resolves its starting directory from the host payload, and each
 * host disagrees about the key and the value's shape: most send a scalar
 * `cwd`, Cursor sends a `workspace_roots` array. These helpers replaced twenty
 * near-identical inline conditionals, so the fallback semantics they encode
 * are pinned here once rather than re-read per adapter.
 */
describe('payloadString', () => {
  it('reads scalar and array-valued fields, skipping empties', () => {
    expect(payloadString({ cwd: '/repo' }, 'cwd')).toBe('/repo');
    expect(payloadString({ workspace_roots: ['/repo', '/other'] }, 'workspace_roots')).toBe(
      '/repo'
    );
    // An empty leading element must not win over a usable later one.
    expect(payloadString({ workspace_roots: ['', '/repo'] }, 'workspace_roots')).toBe('/repo');
  });

  it('returns undefined for missing, empty, and non-string values', () => {
    expect(payloadString({}, 'cwd')).toBeUndefined();
    expect(payloadString({ cwd: '' }, 'cwd')).toBeUndefined();
    expect(payloadString({ cwd: 42 }, 'cwd')).toBeUndefined();
    expect(payloadString({ cwd: null }, 'cwd')).toBeUndefined();
    expect(payloadString({ workspace_roots: [] }, 'workspace_roots')).toBeUndefined();
    expect(payloadString({ workspace_roots: [7, {}] }, 'workspace_roots')).toBeUndefined();
  });

  it('tries keys in order and returns the first usable one', () => {
    expect(payloadString({ b: '/second' }, 'a', 'b')).toBe('/second');
    expect(payloadString({ a: '', b: '/second' }, 'a', 'b')).toBe('/second');
    expect(payloadString({ a: '/first', b: '/second' }, 'a', 'b')).toBe('/first');
  });
});

describe('hookStartCwd', () => {
  it('defaults to the cwd key and falls back to the process cwd', () => {
    expect(hookStartCwd({ cwd: '/repo' })).toBe('/repo');
    expect(hookStartCwd({})).toBe(process.cwd());
    expect(hookStartCwd({ cwd: '' })).toBe(process.cwd());
    expect(hookStartCwd({ cwd: 42 })).toBe(process.cwd());
  });

  it('accepts an explicit key list for hosts that name the field differently', () => {
    expect(hookStartCwd({ workspace_roots: ['/repo'] }, 'workspace_roots')).toBe('/repo');
    expect(hookStartCwd({ workspace_roots: 'not-an-array' }, 'workspace_roots')).toBe(
      'not-an-array'
    );
    expect(hookStartCwd({ cwd: '/ignored' }, 'workspace_roots')).toBe(process.cwd());
  });
});
