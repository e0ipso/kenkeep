import { spawn } from 'node:child_process';
import { resolveActiveHarness } from '../harnesses/detect.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

/**
 * Identity of one of the three kk skills the CLI launcher commands can
 * dispatch into the host harness. The string after `kk-` is what gets
 * suffixed onto the `/kk-…` slash command (`/kk-bootstrap`, `/kk-curate`,
 * `/kk-add`).
 */
export type LauncherSkill = 'kk-bootstrap' | 'kk-curate' | 'kk-add';

export interface LaunchSkillOptions {
  /** Slash-command skill to invoke in the harness. */
  skill: LauncherSkill;
  /**
   * Trailing argument string appended after the slash command in the
   * single `-p` payload. Empty string when the launcher has nothing
   * extra to pass through. Already shell-safe because the harness child
   * receives it as one positional argv element, not a shell-evaluated
   * string.
   */
  passedArgs?: string;
  /**
   * `--harness <id>` flag value (caller-supplied). Routed straight into
   * `resolveActiveHarness`.
   */
  harness?: string | undefined;
  /**
   * Optional `spawn` override; tests inject a fake so they can assert on
   * the resolved binary, argv, and env without actually running a
   * subprocess. Production callers omit this and get `node:child_process`'s
   * `spawn`.
   */
  spawnFn?: typeof spawn;
  /**
   * Optional `process.exit` override; tests inject a no-op to keep the
   * test process alive. Defaults to `process.exit`.
   */
  exitFn?: (code: number) => never;
}

/**
 * Builds the full argv array for a harness launch. The prefix is the
 * harness-specific entrypoint (e.g. `['-p']`, `['exec']`, `['run']`).
 * The slash payload is the skill name plus optional trailing arguments.
 * Shared across all adapters; each harness only declares its prefix.
 */
export function buildLaunchArgs(
  prefix: readonly string[],
  skill: string,
  passedArgs?: string
): string[] {
  const passed = passedArgs?.trim() ?? '';
  const slashPayload = passed.length > 0 ? `/${skill} ${passed}` : `/${skill}`;
  return [...prefix, slashPayload];
}

/**
 * Resolves the active harness, builds the slash-command argv, and spawns
 * the harness binary with the user's stdio inherited (so Ctrl-C, TTY
 * prompts, and the harness's rich output flow naturally). Exits the
 * current process with the child's exit code on close.
 *
 * `KENKEEP_BUILDER_INTERNAL=1` is set on the child's env so the spawned
 * harness session's own SessionStart hook does not re-issue our pending
 * sessions nudge — that would cause an immediate recursion if the user
 * is already inside a host kk session.
 */
export function launchSkill(opts: LaunchSkillOptions): void {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const harness = resolveActiveHarness({
    ...(opts.harness !== undefined ? { flag: opts.harness } : {}),
    ...(settings.cliDefaultHarness !== undefined ? { cliDefault: settings.cliDefaultHarness } : {}),
  });

  const binary = harness.launchBinary;
  const args = buildLaunchArgs(harness.launchArgsPrefix, opts.skill, opts.passedArgs);

  const spawnImpl = opts.spawnFn ?? spawn;
  const exitImpl = opts.exitFn ?? ((code: number): never => process.exit(code));

  const child = spawnImpl(binary, args, {
    stdio: 'inherit',
    env: { ...process.env, KENKEEP_BUILDER_INTERNAL: '1' },
  });

  child.on('close', code => {
    exitImpl(code ?? 1);
  });
}
