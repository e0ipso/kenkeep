/**
 * Shared scaffold for kenkeep hook entry points.
 *
 * Owns: the KENKEEP_BUILDER_INTERNAL recursion guard; the optional hard-deadline
 * timer with a diagnostic log on fire; stdin reading (or async-launcher payload
 * resolution when `asyncLauncher: true`); JSON parsing with an optional 'parse'
 * diagnostic on non-empty unparseable input; the outer `.catch` block with an
 * 'uncaught' diagnostic and `process.exit(0)`.
 *
 * Per-adapter hook files keep only their unique logic (cwd/root resolution,
 * pipeline invocation) inside the `main` callback.
 */
import {
  isLauncherChild,
  launchDetachedWorker,
  launcherPayload,
  LAUNCHER_STDIN_DEADLINE_MS,
} from './async-launcher.js';
import { appendHookDiagnostic } from './hook-diagnostic.js';
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
   * When `true`, route this long-running, non-context hook through the canonical
   * async launcher (`async-launcher.ts`) on harnesses that lack native async.
   *
   * The launcher child (identified by the launcher marker) reads its payload
   * from the launcher env var and runs the work inline. The first invocation
   * launches that detached child *before* any unbounded or host-dependent
   * operation — a best-effort bounded stdin capture is the only thing that
   * precedes the launch — then exits, freeing the host hook slot regardless of
   * the host's stdin or timeout behavior.
   *
   * Use only for advisory workers (proposal drain, lint tick), never for
   * context-producing hooks that must return data to the host.
   */
  asyncLauncher?: boolean;

  /**
   * When `true`, return early (without calling `main`) if stdin is empty.
   * Use for capture hooks whose payload is mandatory.
   * When `false` (default), empty or unparseable stdin produces `{}` and
   * `main` is still called (a 'parse' diagnostic is written for non-empty
   * unparseable input).
   */
  requirePayload?: boolean;

  /**
   * Controls handling for non-empty stdin that is not valid JSON. The default
   * writes a parse diagnostic before continuing with `{}` or returning for
   * `requirePayload` hooks. Use `'ignore'` for hosts where absent or malformed
   * payloads are an expected fail-open condition.
   */
  invalidJson?: 'diagnostic' | 'ignore';

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
  const {
    tag,
    deadlineMs,
    asyncLauncher = false,
    requirePayload = false,
    invalidJson = 'diagnostic',
    main,
  } = options;

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

    // Stdin acquisition — route through the async launcher when requested.
    let raw: string;
    if (asyncLauncher) {
      if (isLauncherChild()) {
        // The detached worker: take the payload the parent captured.
        raw = launcherPayload();
      } else {
        // Capture the payload with a hard bound so the launch never waits on a
        // host that holds stdin open without EOF, then launch the detached
        // worker before any host-dependent or unbounded operation and exit so
        // the host hook slot frees immediately. The detached child is in its
        // own process group, so a host hook-timeout kill cannot reach it; no
        // parent-side deadline is needed because the parent does not run the
        // work.
        const captured = await readStdin({ deadlineMs: LAUNCHER_STDIN_DEADLINE_MS });
        if (launchDetachedWorker(captured)) {
          process.exit(0);
        }
        // Re-spawn impossible (no script path): fall back to inline work.
        raw = captured;
      }
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
        if (invalidJson === 'diagnostic') {
          const paths = repoPaths(findRepoRoot(process.cwd()));
          appendHookDiagnostic(tag, 'parse', err, paths.logsDir);
        }
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
