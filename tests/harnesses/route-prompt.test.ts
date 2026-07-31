import { describe, expect, it } from 'vitest';
import { routePrompt } from '../../src/lib/headless-run.js';

/**
 * `routePrompt` is a correctness guard, not a style preference. Linux caps a
 * single argv element at MAX_ARG_STRLEN (128 KiB) independently of the total
 * ARG_MAX, so a prompt carrying a whole session transcript fails the spawn
 * outright with E2BIG when passed as one argument. Codex and Cursor both
 * accept a `-` placeholder, and both used to carry their own copy of this
 * decision; these assertions pin the shared one.
 */
describe('routePrompt', () => {
  it('keeps a small prompt in argv when there is no stdin payload', () => {
    expect(routePrompt('small prompt', '')).toEqual({
      promptArg: 'small prompt',
      childStdin: '',
    });
  });

  it('routes through stdin whenever the caller supplied stdin content', () => {
    expect(routePrompt('prompt', 'transcript')).toEqual({
      promptArg: '-',
      childStdin: 'transcript',
    });
  });

  it('routes a large prompt through stdin even with no stdin payload', () => {
    const big = 'x'.repeat(64 * 1024 + 1);
    const routed = routePrompt(big, '');
    expect(routed.promptArg).toBe('-');
    expect(routed.childStdin).toBe(big);
  });

  it('measures the threshold in bytes, not code units', () => {
    // 40k multi-byte characters are under the limit by length but over it by
    // UTF-8 bytes; measuring with .length would let an E2BIG spawn through.
    const multibyte = '€'.repeat(40 * 1024);
    expect(multibyte.length).toBeLessThan(64 * 1024);
    expect(Buffer.byteLength(multibyte, 'utf8')).toBeGreaterThan(64 * 1024);
    expect(routePrompt(multibyte, '').promptArg).toBe('-');
  });

  it('stays in argv exactly at the threshold', () => {
    const atLimit = 'x'.repeat(64 * 1024);
    expect(routePrompt(atLimit, '').promptArg).toBe(atLimit);
  });
});
