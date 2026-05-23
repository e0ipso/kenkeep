import { launchSkill } from '../lib/launch-skill.js';

export interface BootstrapLauncherOptions {
  from?: string | undefined;
  harness?: string | undefined;
}

/**
 * Thin launcher for the `kb-bootstrap` skill: resolves the active
 * harness, then execs `<harness-binary> -p "/kb-bootstrap [--from <scope>]"`
 * with `KB_BUILDER_INTERNAL=1` set on the child env and stdio inherited.
 *
 * The LLM work itself happens entirely inside the spawned harness
 * session. This command never invokes a model directly and never spawns
 * a per-batch sub-agent.
 */
export function runBootstrapLauncher(opts: BootstrapLauncherOptions = {}): void {
  const passed = opts.from !== undefined ? `--from ${opts.from}` : '';
  const launchOpts: Parameters<typeof launchSkill>[0] = {
    skill: 'kb-bootstrap',
    passedArgs: passed,
  };
  if (opts.harness !== undefined) launchOpts.harness = opts.harness;
  launchSkill(launchOpts);
}
