/**
 * Shared scaffold for kenkeep hook entry points.
 *
 * Owns: the KENKEEP_BUILDER_INTERNAL recursion guard; the optional hard-deadline
 * timer with a diagnostic log on fire; stdin reading (or detach-pattern stdin
 * resolution when `detach: true`); JSON parsing with a 'parse' diagnostic on
 * non-empty unparseable input; the outer `.catch` block with an 'uncaught'
 * diagnostic and `process.exit(0)`.
 *
 * Per-adapter hook files keep only their unique logic (cwd/root resolution,
 * pipeline invocation) inside the `main` callback.
 */
import { appendHookDiagnostic } from './hook-diagnostic.js';
import { detachedPayload, detachSelf, isDetachedChild } from './hook-detach.js';
import { findRepoRoot, repoPaths } from './paths.js';
import { readStdin } from './stdin.js';

export interface HookEntryOptions {
  /**
   * Identifies this hook in diagnostic log entries (e.g. `'claude:kk-capture'`).
   */
  tag: string;

  /**
   * Hard wall-clock deadline in milliseconds. When the timer fires the hook
   * writes a 'deadline' diagnostic then exits 0. Omit or pass `undefined` to
   * run without a deadline. Defaults to `undefined` (no deadline).
   */
  deadlineMs?: number;

  /**
   * When `true`, use the detach-pattern for stdin: if this process is the
   * detached background child read from `KENKEEP_HOOK_PAYLOAD`; otherwise read
   * from stdin, then re-spawn a detached child carrying the raw payload and
   * return immediately so the host hook slot is freed.
   *
   * Applies only to hooks that need it (Codex, Copilot, Cursor proposal-drain).
   */
  detach?: boolean;

  /**
   * When `true`, return early (without calling `main`) if stdin is empty.
   * Use for capture hooks whose payload is mandatory.
   * When `false` (default), empty or unparseable stdin produces `{}` and
   * `main` is still called (a 'parse' diagnostic is written for non-empty
   * unparseable input).
   */
  requirePayload?: boolean;

  /**
   * The hook body. Receives the parsed payload object and the raw stdin string.
   * For capture hooks `payload` is the actual JSON-parsed object (since
   * `requirePayload: true` guarantees it). For other hooks `payload` may be `{}`
   * when stdin was empty or unparseable.
   */
  main: (payload: Record<string, unknown>, raw: string) => Promise<void>;
}

/**
 * Runs the standard kenkeep hook entry scaffold, then calls `options.main`.
 * Returns `void`; the function is fire-and-forget (call without `await`).
 */
export function runHookEntry(options: HookEntryOptions): void {
  const { tag, deadlineMs, detach = false, requirePayload = false, main } = options;

  async function run(): Promise<void> {
    // Recursion guard: prevent re-entry when our own headless runners
    // (runHeadlessClaude, runHeadlessCodex, etc.) spawn child processes.
    if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

    // Hard wall-clock deadline. When it fires we record a diagnostic so the
    // abandoned work is traceable, then exit 0 so the host is never blocked.
    if (deadlineMs !== undefined) {
      const deadline = setTimeout(() => {
        try {
          const paths = repoPaths(findRepoRoot(process.cwd()));
          appendHookDiagnostic(
            tag,
            'deadline',
            new Error('hook hard deadline reached; work abandoned'),
            paths.logsDir
          );
        } catch {
          // Outside any project / cannot resolve paths.
        }
        process.exit(0);
      }, deadlineMs);
      deadline.unref();
    }

    // Stdin acquisition — honour the detach pattern when requested.
    let raw: string;
    if (detach) {
      raw = isDetachedChild() ? detachedPayload() : await readStdin();
      if (!isDetachedChild() && detachSelf(raw)) return;
    } else {
      raw = await readStdin();
    }

    // Early-exit on empty stdin for hooks that require a payload.
    if (requirePayload && raw.trim().length === 0) return;

    // JSON parse. For non-empty unparseable input write a 'parse' diagnostic
    // and either return (requirePayload) or continue with {} (otherwise).
    let payload: Record<string, unknown> = {};
    if (raw.trim().length > 0) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch (err) {
        const paths = repoPaths(findRepoRoot(process.cwd()));
        appendHookDiagnostic(tag, 'parse', err, paths.logsDir);
        if (requirePayload) return;
        // Fall through with payload = {}
      }
    }

    await main(payload, raw);
  }

  void run().catch((err: unknown) => {
    try {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic(tag, 'uncaught', err, paths.logsDir);
    } catch {
      // Outside any project / cannot resolve paths — nothing to log to.
    }
    process.exit(0);
  });
}
