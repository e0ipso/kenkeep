import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import {
  errCheck,
  ok,
  warnCheck,
  type DoctorCheckResult,
  type NamedDoctorCheck,
} from '../types.js';
import { codexHookSpecs } from './hook-spec.js';
import { codexPaths } from './install.js';

const exec = promisify(execFile);
const EXPECTED_SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate'];
const TOML_HOOKS_HEADER = /^\s*\[hooks\b/m;

export async function codexDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = codexPaths(paths.root);
  return [
    { name: 'codex CLI on PATH', result: await checkCodexCli() },
    {
      name: 'Codex hooks registered',
      result: checkCodexHooks(locs.hooksFile, locs.hooksDir, locs.configToml),
    },
    { name: 'Codex skills installed', result: checkCodexSkills(locs.skillsDir) },
  ];
}

async function checkCodexCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('codex', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(`not runnable (${(e as Error).message.split('\n')[0]})`);
  }
}

function checkCodexHooks(
  hooksFile: string,
  hooksDir: string,
  configToml: string
): DoctorCheckResult {
  if (existsSync(configToml)) {
    try {
      const toml = readFileSync(configToml, 'utf8');
      if (TOML_HOOKS_HEADER.test(toml)) {
        return warnCheck(
          `inline [hooks] table detected in .codex/config.toml; see docs/installation/codex-toml-hooks-coexistence.md for the migration to .codex/hooks.json.`
        );
      }
    } catch {
      // Unreadable TOML is surfaced by Codex itself; do not block the doctor.
    }
  }
  if (!existsSync(hooksFile)) {
    return errCheck('no .codex/hooks.json. Run `npx kenkeep init --harnesses codex --upgrade`.');
  }
  let parsed: {
    hooks?: Record<string, Array<{ hooks?: Array<{ type?: string; command?: string }> }>>;
  };
  try {
    parsed = JSON.parse(readFileSync(hooksFile, 'utf8')) as typeof parsed;
  } catch (e) {
    return errCheck(`unparseable: ${(e as Error).message}`);
  }
  const eventTable = parsed.hooks ?? {};
  const missingRegs: string[] = [];
  const missingFiles = new Set<string>();
  for (const spec of codexHookSpecs) {
    const buckets = eventTable[spec.event] ?? [];
    const found = buckets.some(bucket =>
      (bucket.hooks ?? []).some(
        entry => typeof entry?.command === 'string' && entry.command.includes(spec.scriptPath)
      )
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
  return errCheck(`${parts.join('; ')}. Re-run \`npx kenkeep init --harnesses codex --upgrade\`.`);
}

function checkCodexSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .agents/skills/ directory. Re-run `npx kenkeep init --harnesses codex --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --upgrade\`.`
      );
}
