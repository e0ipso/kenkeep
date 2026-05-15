import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import {
  errCheck,
  ok,
  type DoctorCheckResult,
  type NamedDoctorCheck,
} from '../types.js';
import { openCodeHookSpecs } from './hook-spec.js';

const exec = promisify(execFile);
const EXPECTED_SKILLS = ['kb-add', 'kb-bootstrap', 'kb-curate'];
export const OPENCODE_PLUGIN_MARKER = '// @e0ipso/ai-knowledge-base plugin';

function openCodeLocations(root: string) {
  const dir = join(root, '.opencode');
  return {
    pluginsDir: join(dir, 'plugins'),
    pluginFile: join(dir, 'plugins', 'kb.mjs'),
    kbHooksDir: join(dir, 'kb-hooks'),
    skillsDir: join(dir, 'skills'),
  };
}

export async function openCodeDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = openCodeLocations(paths.root);
  return [
    { name: 'opencode CLI on PATH', result: await checkOpenCodeCli() },
    { name: 'OpenCode plugin installed', result: checkPlugin(locs.pluginFile) },
    {
      name: 'OpenCode kb-hooks installed',
      result: checkKbHooks(locs.kbHooksDir),
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
      'no .opencode/plugins/kb.mjs. Run `npx @e0ipso/ai-knowledge-base init --harnesses opencode --force`.'
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
        `Re-run \`npx @e0ipso/ai-knowledge-base init --harnesses opencode --force\`.`
    );
  }
  return ok('plugin marker present');
}

function checkKbHooks(kbHooksDir: string): DoctorCheckResult {
  if (!existsSync(kbHooksDir)) {
    return errCheck(
      'no .opencode/kb-hooks/. Re-run `npx @e0ipso/ai-knowledge-base init --harnesses opencode --force`.'
    );
  }
  const expected = new Set(openCodeHookSpecs.map(s => s.scriptPath));
  const missing = [...expected].filter(name => !existsSync(join(kbHooksDir, name)));
  if (missing.length === 0) {
    return ok([...expected].sort().join(', '));
  }
  return errCheck(
    `missing scripts: ${missing.join(', ')}. ` +
      `Re-run \`npx @e0ipso/ai-knowledge-base init --harnesses opencode --force\`.`
  );
}

function checkSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .opencode/skills/ directory. Re-run `npx @e0ipso/ai-knowledge-base init --harnesses opencode --force`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx @e0ipso/ai-knowledge-base init --upgrade\`.`
      );
}
