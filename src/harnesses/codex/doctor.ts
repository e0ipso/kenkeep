import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { sharedSkillsDoctorCheck } from '../../lib/install-skills.js';
import { hookRegistrationDoctorCheck, sharedHookScriptPath } from '../../lib/shared-hooks.js';
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
const TOML_HOOKS_HEADER = /^\s*\[hooks\b/m;

export async function codexDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = codexPaths(paths.root);
  return [
    { name: 'codex CLI on PATH', result: await checkCodexCli() },
    {
      name: 'Codex hooks registered',
      result: checkCodexHooks(locs.hooksFile, locs.hooksDir, locs.configToml),
    },
    {
      name: 'Codex skills installed',
      result: sharedSkillsDoctorCheck(locs.skillsDir, '.agents/skills/', 'codex'),
    },
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
          `inline [hooks] table detected in .codex/config.toml; see the Codex notes in docs/installation.md for the migration to .codex/hooks.json.`
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
  for (const spec of codexHookSpecs) {
    const expectedScriptPath = sharedHookScriptPath('codex', spec.scriptPath);
    const buckets = eventTable[spec.event] ?? [];
    const found = buckets.some(bucket =>
      (bucket.hooks ?? []).some(
        entry => typeof entry?.command === 'string' && entry.command.includes(expectedScriptPath)
      )
    );
    if (!found) missingRegs.push(`${spec.event} -> ${expectedScriptPath}`);
  }
  return hookRegistrationDoctorCheck(missingRegs, hooksDir, codexHookSpecs, 'codex');
}
