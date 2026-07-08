import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { EXPECTED_SKILLS } from '../../lib/install-skills.js';
import {
  errCheck,
  ok,
  warnCheck,
  type DoctorCheckResult,
  type NamedDoctorCheck,
} from '../types.js';
import { kiroPaths } from './install.js';

const exec = promisify(execFile);

const KIRO_DOCS_URL = 'https://kiro.dev';

/**
 * Returns doctor checks specific to the Kiro CLI adapter:
 *   - `kiro-cli-chat` binary on PATH
 *   - `.kiro/skills/` exists and contains expected skill directories
 *   - `.kiro/steering/` readable (warn if absent, not error — steering is
 *     optional; projects can run without it)
 *
 * Note: no hook registration check in v1 since `KIRO_HOOK_SPECS` is empty.
 */
export async function kiroDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = kiroPaths(paths.root);
  return [
    { name: 'kiro-cli-chat binary on PATH', result: await checkKiroCli() },
    { name: 'Kiro skills installed', result: checkKiroSkills(locs.skillsDir) },
    { name: 'Kiro steering directory', result: checkKiroSteering(paths.root) },
  ];
}

async function checkKiroCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('kiro-cli-chat', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(
      `not runnable (${(e as Error).message.split('\n')[0]}); install Kiro CLI from ${KIRO_DOCS_URL}`
    );
  }
}

function checkKiroSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .kiro/skills/ directory. Re-run `npx kenkeep init --harnesses kiro --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses kiro --upgrade\`.`
      );
}

function checkKiroSteering(root: string): DoctorCheckResult {
  const steeringDir = join(root, '.kiro', 'steering');
  if (!existsSync(steeringDir)) {
    return warnCheck(
      '.kiro/steering/ absent; project steering files are optional but recommended for consistent session behavior.'
    );
  }
  return ok('.kiro/steering/ present');
}
