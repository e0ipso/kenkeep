import { launchSkill } from '../lib/launch-skill.js';

export interface NodeAddLauncherOptions {
  harness?: string | undefined;
}

/**
 * Thin launcher for the `kb-add` skill: resolves the active harness,
 * then execs `<harness-binary> -p "/kb-add"` with
 * `KB_BUILDER_INTERNAL=1` on the child env and stdio inherited.
 *
 * The interactive prompt flow and slug-collision guard previously
 * implemented in this command file are now responsibilities of the
 * `/kb-add` skill prompt and the `node write` CLI primitive. This
 * launcher carries no flags; the skill collects whatever it needs
 * inside the harness session.
 */
export function runNodeAddLauncher(opts: NodeAddLauncherOptions = {}): void {
  const launchOpts: Parameters<typeof launchSkill>[0] = {
    skill: 'kb-add',
    passedArgs: '',
  };
  if (opts.harness !== undefined) launchOpts.harness = opts.harness;
  launchSkill(launchOpts);
}
