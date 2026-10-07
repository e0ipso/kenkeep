import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { sharedSkillsDoctorCheck } from '../../lib/install-skills.js';
import { hookRegistrationDoctorCheck, sharedHookScriptPath } from '../../lib/shared-hooks.js';
import { errCheck, ok, type NamedDoctorCheck, type DoctorCheckResult } from '../types.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { claudePaths } from './install.js';

const exec = promisify(execFile);

export async function claudeDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = claudePaths(paths.root);
  return [
    { name: 'claude CLI on PATH', result: await checkClaudeCli() },
    {
      name: 'Claude hooks registered',
      result: checkClaudeHooks(locs.settingsFile, locs.hooksDir),
    },
    {
      name: 'Claude skills installed',
      result: sharedSkillsDoctorCheck(locs.skillsDir, '.claude/skills/', 'claude'),
    },
  ];
}

async function checkClaudeCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('claude', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(`not runnable (${(e as Error).message.split('\n')[0]})`);
  }
}

function checkClaudeHooks(settingsFile: string, hooksDir: string): DoctorCheckResult {
  if (!existsSync(settingsFile)) {
    return errCheck(
      'no .claude/settings.json. Run `npx kenkeep init --harnesses claude --upgrade`.'
    );
  }
  let settings: { hooks?: Record<string, Array<{ hooks: Array<{ command?: string }> }>> };
  try {
    settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as typeof settings;
  } catch (e) {
    return errCheck(`unparseable: ${(e as Error).message}`);
  }
  const hooks = settings.hooks ?? {};
  const missingRegs: string[] = [];
  for (const spec of CLAUDE_HOOK_SPECS) {
    const expectedScriptPath = sharedHookScriptPath('claude', spec.scriptPath);
    const cmds = (hooks[spec.event] ?? []).flatMap(e => (e.hooks ?? []).map(h => h.command ?? ''));
    if (!cmds.some(c => c.includes(expectedScriptPath))) {
      missingRegs.push(`${spec.event} -> ${expectedScriptPath}`);
    }
  }
  return hookRegistrationDoctorCheck(missingRegs, hooksDir, CLAUDE_HOOK_SPECS, 'claude');
}
