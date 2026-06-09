import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { errCheck, ok, type NamedDoctorCheck, type DoctorCheckResult } from '../types.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { claudePaths } from './install.js';

const exec = promisify(execFile);
const EXPECTED_SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate'];

export async function claudeDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = claudePaths(paths.root);
  return [
    { name: 'claude CLI on PATH', result: await checkClaudeCli() },
    {
      name: 'Claude hooks registered',
      result: checkClaudeHooks(locs.settingsFile, locs.hooksDir),
    },
    { name: 'Claude skills installed', result: checkClaudeSkills(locs.skillsDir) },
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
  const missingFiles = new Set<string>();
  for (const spec of CLAUDE_HOOK_SPECS) {
    const cmds = (hooks[spec.event] ?? []).flatMap(e => (e.hooks ?? []).map(h => h.command ?? ''));
    if (!cmds.some(c => c.includes(spec.scriptPath))) {
      missingRegs.push(`${spec.event} -> ${spec.scriptPath}`);
    }
    if (!existsSync(join(hooksDir, spec.scriptPath))) missingFiles.add(spec.scriptPath);
  }
  if (missingRegs.length === 0 && missingFiles.size === 0) {
    return ok('all expected hook entries and scripts present');
  }
  const parts: string[] = [];
  if (missingRegs.length > 0) parts.push(`missing registrations: ${missingRegs.join(', ')}`);
  if (missingFiles.size > 0) parts.push(`missing scripts: ${[...missingFiles].join(', ')}`);
  return errCheck(`${parts.join('; ')}. Re-run \`npx kenkeep init --harnesses claude --upgrade\`.`);
}

function checkClaudeSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .claude/skills/ directory. Re-run `npx kenkeep init --harnesses claude --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --upgrade\`.`
      );
}
