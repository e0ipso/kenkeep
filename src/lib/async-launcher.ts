import { spawn } from 'node:child_process';

/**
 * Canonical cross-harness async hook launcher.
 *
 * Long-running, non-context hooks (proposal drain, lint tick) must never block
 * session startup. On harnesses with native async support this is the host's
 * job (Claude `async: true`, OpenCode plugin dispatch). On harnesses that lack
 * it (Codex, Cursor, Copilot) the launcher provides the guarantee in the
 * runtime: it re-spawns the current hook script as a detached, `unref`'d child
 * in its own process group and the parent returns immediately, freeing the
 * host's hook slot. Because the child is detached, a host-side hook-timeout
 * kill of the parent cannot reach it; the worker runs to completion in the
 * background.
 *
 * The launcher is deliberately a thin wrapper over the proven detached-spawn
 * idiom (`detached`, `stdio: 'ignore'`, `unref()`); it introduces no new
 * dependency. Its contract is two environment variables carried into the child:
 * a marker identifying the child, and the captured hook payload.
 */

/** Marks the re-spawned launcher child so it runs the worker inline. */
export const LAUNCHER_CHILD_ENV = 'KENKEEP_ASYNC_LAUNCHER_CHILD';

/** Carries the hook payload captured by the parent into the launcher child. */
export const LAUNCHER_PAYLOAD_ENV = 'KENKEEP_HOOK_PAYLOAD';

/**
 * Best-effort bound on the parent's pre-launch stdin capture. A cooperative
 * host writes the payload and closes stdin well within this window, so the
 * normal path is not slowed; a host that holds stdin open without EOF makes the
 * capture resolve here with whatever arrived, so the launch never waits on the
 * host. Kept far below any real host hook timeout.
 */
export const LAUNCHER_STDIN_DEADLINE_MS = 250;

export function isLauncherChild(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[LAUNCHER_CHILD_ENV] === '1';
}

export function launcherPayload(env: NodeJS.ProcessEnv = process.env): string {
  return env[LAUNCHER_PAYLOAD_ENV] ?? '';
}

/**
 * Re-spawns the current hook script as a detached background worker carrying
 * `rawPayload` in the launcher's payload env var.
 *
 * Returns true when the child was spawned — the caller must return/exit so the
 * host slot frees and the worker continues in the background; false when
 * re-spawning is impossible (no resolvable script path), in which case the
 * caller should fall back to running the work inline.
 */
export function launchDetachedWorker(rawPayload: string): boolean {
  const script = process.argv[1];
  if (!script) return false;
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, [LAUNCHER_CHILD_ENV]: '1', [LAUNCHER_PAYLOAD_ENV]: rawPayload },
  });
  child.unref();
  return true;
}
