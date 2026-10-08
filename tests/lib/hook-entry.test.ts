import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The scaffold reads stdin and writes diagnostics through these two modules;
// both are replaced so the test drives the timer lifecycle alone.
vi.mock('../../src/lib/stdin.js', () => ({ readStdin: vi.fn(async () => '') }));
vi.mock('../../src/lib/hook-diagnostic.js', () => ({ appendHookDiagnostic: vi.fn() }));

import { appendHookDiagnostic } from '../../src/lib/hook-diagnostic.js';
import { runHookEntry } from '../../src/lib/hook-entry.js';

/** Let every pending microtask (the awaited stdin read, `main`, the finally) settle. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('runHookEntry deadline lifecycle', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    vi.mocked(appendHookDiagnostic).mockClear();
  });
  afterEach(() => {
    exitSpy.mockRestore();
    vi.useRealTimers();
  });

  it('clears the deadline timer after a fast success: no abandonment diagnostic, no exit', async () => {
    const main = vi.fn(async () => undefined);
    runHookEntry({ tag: 'test:fast', deadlineMs: 50, main });
    await flushMicrotasks();
    expect(main).toHaveBeenCalledTimes(1);

    // Well past the deadline: a leaked timer would log 'deadline' and exit.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(appendHookDiagnostic).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('still abandons work that is pending at the deadline, with a diagnostic', async () => {
    const main = vi.fn(() => new Promise<void>(() => undefined));
    runHookEntry({ tag: 'test:stuck', deadlineMs: 50, main });
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(60);
    expect(appendHookDiagnostic).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendHookDiagnostic).mock.calls[0]?.[0]).toBe('test:stuck');
    expect(vi.mocked(appendHookDiagnostic).mock.calls[0]?.[1]).toBe('deadline');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
