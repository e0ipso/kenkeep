import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { sharedSkillsDoctorCheck } from '../../lib/install-skills.js';
import { hookRegistrationDoctorCheck, sharedHookScriptPath } from '../../lib/shared-hooks.js';
import { errCheck, ok, type DoctorCheckResult, type NamedDoctorCheck } from '../types.js';
import { cursorHookSpecs } from './hook-spec.js';
import { cursorPaths } from './install.js';

const exec = promisify(execFile);

export async function cursorDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = cursorPaths(paths.root);
  return [
    { name: 'Cursor agent CLI on PATH', result: await checkAgentCli() },
    {
      name: 'Cursor hooks registered',
      result: checkCursorHooks(locs.hooksFile, locs.hooksDir),
    },
    {
      name: 'Cursor skills installed',
      result: sharedSkillsDoctorCheck(locs.skillsDir, '.cursor/skills/', 'cursor'),
    },
  ];
}

async function checkAgentCli(): Promise<DoctorCheckResult> {
  for (const [cmd, args] of [
    ['agent', ['--version']],
    ['cursor', ['agent', '--version']],
  ] as const) {
    try {
      const { stdout } = await exec(cmd, args, { timeout: 5000 });
      return ok(stdout.trim() || 'present');
    } catch {
      // try next candidate
    }
  }
  return errCheck('neither `agent` nor `cursor agent` is runnable on PATH');
}

function checkCursorHooks(hooksFile: string, hooksDir: string): DoctorCheckResult {
  if (!existsSync(hooksFile)) {
    return errCheck('no .cursor/hooks.json. Run `npx kenkeep init --harnesses cursor --upgrade`.');
  }
  let parsed: { hooks?: Record<string, Array<{ command?: string }>> };
  try {
    parsed = JSON.parse(readFileSync(hooksFile, 'utf8')) as typeof parsed;
  } catch (e) {
    return errCheck(`unparseable: ${(e as Error).message}`);
  }
  const eventTable = parsed.hooks ?? {};
  const missingRegs: string[] = [];
  for (const spec of cursorHookSpecs) {
    const expectedScriptPath = sharedHookScriptPath('cursor', spec.scriptPath);
    const entries = eventTable[spec.event] ?? [];
    const found = entries.some(
      entry => typeof entry?.command === 'string' && entry.command.includes(expectedScriptPath)
    );
    if (!found) missingRegs.push(`${spec.event} -> ${expectedScriptPath}`);
  }
  return hookRegistrationDoctorCheck(missingRegs, hooksDir, cursorHookSpecs, 'cursor');
}
