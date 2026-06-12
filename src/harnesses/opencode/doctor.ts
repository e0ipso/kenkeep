import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { EXPECTED_SKILLS } from '../../lib/install-skills.js';
import { errCheck, ok, type DoctorCheckResult, type NamedDoctorCheck } from '../types.js';
import { openCodeHookSpecs } from './hook-spec.js';
import { openCodePaths } from './install.js';

const exec = promisify(execFile);
export const OPENCODE_PLUGIN_MARKER = '// kenkeep plugin';

export async function openCodeDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = openCodePaths(paths.root);
  return [
    { name: 'opencode CLI on PATH', result: await checkOpenCodeCli() },
    { name: 'OpenCode plugin installed', result: checkPlugin(locs.pluginFile) },
    {
      name: 'OpenCode kk-hooks installed',
      result: checkKbHooks(locs.kkHooksDir),
    },
    { name: 'OpenCode skills installed', result: checkSkills(locs.skillsDir) },
  ];
}

async function checkOpenCodeCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('opencode', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(
      `not runnable (${(e as Error).message.split('\n')[0]}). ` +
        `Install: https://opencode.ai/docs/cli/installation`
    );
  }
}

function checkPlugin(pluginFile: string): DoctorCheckResult {
  if (!existsSync(pluginFile)) {
    return errCheck(
      'no .opencode/plugins/kk.mjs. Run `npx kenkeep init --harnesses opencode --upgrade`.'
    );
  }
  let contents: string;
  try {
    contents = readFileSync(pluginFile, 'utf8');
  } catch (e) {
    return errCheck(`unreadable: ${(e as Error).message}`);
  }
  if (!contents.includes(OPENCODE_PLUGIN_MARKER)) {
    return errCheck(
      `plugin file does not carry the package marker (expected leading comment ${OPENCODE_PLUGIN_MARKER}). ` +
        `Re-run \`npx kenkeep init --harnesses opencode --upgrade\`.`
    );
  }
  return ok('plugin marker present');
}

function checkKbHooks(kkHooksDir: string): DoctorCheckResult {
  if (!existsSync(kkHooksDir)) {
    return errCheck(
      'no .opencode/kk-hooks/. Re-run `npx kenkeep init --harnesses opencode --upgrade`.'
    );
  }
  const expected = new Set(openCodeHookSpecs.map(s => s.scriptPath));
  const missing = [...expected].filter(name => !existsSync(join(kkHooksDir, name)));
  if (missing.length === 0) {
    return ok([...expected].sort().join(', '));
  }
  return errCheck(
    `missing scripts: ${missing.join(', ')}. ` +
      `Re-run \`npx kenkeep init --harnesses opencode --upgrade\`.`
  );
}

function checkSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .opencode/skills/ directory. Re-run `npx kenkeep init --harnesses opencode --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --upgrade\`.`
      );
}
