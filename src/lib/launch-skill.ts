import { spawn } from 'node:child_process';
import { resolveActiveHarness } from '../harnesses/detect.js';
import type { HarnessAdapter } from '../harnesses/types.js';
import { log } from './log.js';
import { findKenkeepRoot, findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  pickModelChoice,
  resolveSettings,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../lib/settings.js';

/**
 * Identity of one of the three kk skills the CLI launcher commands can
 * dispatch into the host harness. The string after `kk-` is what gets
 * suffixed onto the `/kk-…` slash command (`/kk-bootstrap`, `/kk-curate`,
 * `/kk-add`).
 */
export type LauncherSkill = 'kk-bootstrap' | 'kk-curate' | 'kk-add';

/**
 * Settings role whose model choice each launcher honors. `kk-add` writes a
 * curated node by hand, so it rides on the curator's model; there is no
 * separate `addModel` setting.
 */
const LAUNCHER_ROLE: Record<LauncherSkill, ModelChoiceRole> = {
  'kk-bootstrap': 'bootstrap',
  'kk-curate': 'curator',
  'kk-add': 'curator',
};

const ROLE_SETTING_KEY: Record<ModelChoiceRole, string> = {
  proposal: 'proposalModel',
  curator: 'curatorModel',
  bootstrap: 'bootstrapModel',
};

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
 * Builds the full argv array for a harness launch: the harness-specific
 * prefix (e.g. `['-p']`, `['exec']`, `['run']`), the adapter's native model
 * flags (empty when no model is configured) and the slash payload, the skill
 * name plus optional trailing arguments, as the final element.
 *
 * The model flags go after the prefix's last subcommand word and before any
 * option in it. A subcommand (`exec`, `run`) scopes the flags, so they must
 * follow it; a prompt option (`-p`) may take the payload as its value, as
 * Copilot's `-p <prompt>` does, so nothing may sit between the two. Shared
 * across all adapters; each harness only declares its prefix and its flags.
 */
export function buildLaunchArgs(
  prefix: readonly string[],
  skill: string,
  passedArgs?: string,
  modelArgs: readonly string[] = []
): string[] {
  const passed = passedArgs?.trim() ?? '';
  const slashPayload = passed.length > 0 ? `/${skill} ${passed}` : `/${skill}`;
  const lastWord = prefix.findLastIndex(arg => !arg.startsWith('-'));
  const subcommands = prefix.slice(0, lastWord + 1);
  const options = prefix.slice(lastWord + 1);
  return [...subcommands, ...modelArgs, ...options, slashPayload];
}

/**
 * Resolves the native model argv for `role` on `adapter` from the settings.
 *
 * - No model configured for the role: `[]`, the host picks its default.
 * - A choice whose `harness` discriminator names another adapter: `[]` plus
 *   a stderr warning naming both harnesses, so the mismatch is visible but
 *   the documented single-entry-per-role contract still launches.
 */
export function resolveLaunchModelArgs(
  adapter: HarnessAdapter,
  settings: EffectiveSettings,
  role: ModelChoiceRole
): string[] {
  const choice = pickModelChoice(settings, role);
  if (!choice) return [];
  const key = ROLE_SETTING_KEY[role];
  if (choice.harness !== adapter.id) {
    log.warn(
      `${key} targets harness '${choice.harness}' but the active harness is '${adapter.id}'; launching with the host default model.`
    );
    return [];
  }
  return adapter.launchModelArgs(choice);
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
  const root = findKenkeepRoot() ?? findRepoRoot();
  const paths = repoPaths(root);
  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const harness = resolveActiveHarness({
    ...(opts.harness !== undefined ? { flag: opts.harness } : {}),
    ...(settings.cliDefaultHarness !== undefined ? { cliDefault: settings.cliDefaultHarness } : {}),
  });

  const binary = harness.launchBinary;
  const modelArgs = resolveLaunchModelArgs(harness, settings, LAUNCHER_ROLE[opts.skill]);
  const args = buildLaunchArgs(harness.launchArgsPrefix, opts.skill, opts.passedArgs, modelArgs);

  const spawnImpl = opts.spawnFn ?? spawn;
  const exitImpl = opts.exitFn ?? ((code: number): never => process.exit(code));

  const child = spawnImpl(binary, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, KENKEEP_BUILDER_INTERNAL: '1' },
  });

  // Without this, a missing binary surfaces as an unhandled 'error' event
  // and a raw ENOENT stack trace instead of an actionable message.
  child.on('error', err => {
    log.error(
      `could not launch '${binary}' (${err.message}). Is the ${harness.id} CLI installed and on PATH?`
    );
    exitImpl(1);
  });

  child.on('close', code => {
    exitImpl(code ?? 1);
  });
}
