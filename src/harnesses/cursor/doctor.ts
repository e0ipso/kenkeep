import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { errCheck, ok, type DoctorCheckResult, type NamedDoctorCheck } from '../types.js';
import { cursorHookSpecs } from './hook-spec.js';
import { cursorPaths } from './install.js';

const exec = promisify(execFile);
const EXPECTED_SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate'];

export async function cursorDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = cursorPaths(paths.root);
  return [
    { name: 'Cursor agent CLI on PATH', result: await checkAgentCli() },
    {
      name: 'Cursor hooks registered',
      result: checkCursorHooks(locs.hooksFile, locs.hooksDir),
    },
    { name: 'Cursor skills installed', result: checkCursorSkills(locs.skillsDir) },
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
  const missingFiles = new Set<string>();
  for (const spec of cursorHookSpecs) {
    const entries = eventTable[spec.event] ?? [];
    const found = entries.some(
      entry => typeof entry?.command === 'string' && entry.command.includes(spec.scriptPath)
    );
    if (!found) missingRegs.push(`${spec.event} -> ${spec.scriptPath}`);
    if (!existsSync(join(hooksDir, spec.scriptPath))) missingFiles.add(spec.scriptPath);
  }
  if (missingRegs.length === 0 && missingFiles.size === 0) {
    return ok('all expected hook entries and scripts present');
  }
  const parts: string[] = [];
  if (missingRegs.length > 0) parts.push(`missing registrations: ${missingRegs.join(', ')}`);
  if (missingFiles.size > 0) parts.push(`missing scripts: ${[...missingFiles].join(', ')}`);
  return errCheck(`${parts.join('; ')}. Re-run \`npx kenkeep init --harnesses cursor --upgrade\`.`);
}

function checkCursorSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .cursor/skills/ directory. Re-run `npx kenkeep init --harnesses cursor --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --upgrade\`.`
      );
}
