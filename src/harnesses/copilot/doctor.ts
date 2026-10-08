import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { sharedSkillsDoctorCheck } from '../../lib/install-skills.js';
import { hookScriptsDoctorCheck, sharedHookScriptPath } from '../../lib/shared-hooks.js';
import {
  errCheck,
  ok,
  warnCheck,
  type DoctorCheckResult,
  type NamedDoctorCheck,
} from '../types.js';
import { copilotHookSpecs } from './hook-spec.js';
import { copilotHome, SENTINEL_END, SENTINEL_START } from './hooks-config.js';
import { copilotPaths } from './install.js';

const exec = promisify(execFile);
const COPILOT_DOCS_URL = 'https://github.com/github/copilot-cli';

export async function copilotDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = copilotPaths(paths.root);
  return [
    { name: 'copilot CLI on PATH', result: await checkCopilotCli() },
    { name: 'Copilot auth', result: checkCopilotAuth() },
    { name: 'Copilot hooks registered', result: checkCopilotHooks(locs.settingsFile) },
    {
      name: 'Copilot hook scripts installed',
      result: hookScriptsDoctorCheck(locs.hooksDir, copilotHookSpecs, 'copilot'),
    },
    {
      name: 'Copilot skills installed',
      result: sharedSkillsDoctorCheck(locs.skillsDir, '.github/skills/', 'copilot'),
    },
    {
      name: 'Copilot instructions sentinel',
      result: checkInstructionsSentinel(locs.instructionsFile),
    },
  ];
}

async function checkCopilotCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('copilot', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(
      `not runnable (${(e as Error).message.split('\n')[0]}); install with \`npm i -g @github/copilot\` (${COPILOT_DOCS_URL})`
    );
  }
}

function checkCopilotAuth(): DoctorCheckResult {
  const token =
    process.env['COPILOT_GITHUB_TOKEN'] ?? process.env['GH_TOKEN'] ?? process.env['GITHUB_TOKEN'];
  if (token && token.length > 0) return ok('GitHub token present in environment');
  if (existsSync(join(copilotHome(), 'settings.json'))) {
    return ok('~/.copilot/settings.json present (assuming interactive `/login` completed)');
  }
  return warnCheck(
    'no GitHub token env var and no ~/.copilot/settings.json; run `copilot` and complete `/login` once. This check is heuristic and may warn falsely when COPILOT_HOME is non-default.'
  );
}

function checkCopilotHooks(hookFile: string): DoctorCheckResult {
  if (!existsSync(hookFile)) {
    return errCheck(`no ${hookFile}. Run \`npx kenkeep init --harnesses copilot --upgrade\`.`);
  }
  let parsed: { hooks?: Record<string, Array<{ type?: string; bash?: string }>> };
  try {
    parsed = JSON.parse(readFileSync(hookFile, 'utf8')) as typeof parsed;
  } catch (e) {
    return errCheck(`unparseable ${hookFile}: ${(e as Error).message}`);
  }
  const eventTable = parsed.hooks ?? {};
  const requiredEvents = [...new Set(copilotHookSpecs.map(s => s.event))];
  const missingEvents = requiredEvents.filter(ev => (eventTable[ev] ?? []).length === 0);
  const missingScripts = copilotHookSpecs
    .filter(spec => {
      const expectedScriptPath = sharedHookScriptPath('copilot', spec.scriptPath);
      return !(eventTable[spec.event] ?? []).some(
        entry => typeof entry?.bash === 'string' && entry.bash.includes(expectedScriptPath)
      );
    })
    .map(spec => `${spec.event} -> ${sharedHookScriptPath('copilot', spec.scriptPath)}`);
  const missing = [...missingEvents, ...missingScripts];
  if (missing.length > 0) {
    return errCheck(
      `missing hook entries for: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses copilot --upgrade\`.`
    );
  }
  return ok(`entries present for ${requiredEvents.join(', ')}`);
}

/**
 * The tracked instructions file carries only the static pointer block;
 * live session context arrives through the sessionStart hook's
 * `additionalContext`. A missing block therefore degrades the always-on
 * pointer, not hook injection, so this stays a warning.
 */
function checkInstructionsSentinel(instructionsFile: string): DoctorCheckResult {
  if (!existsSync(instructionsFile)) {
    return warnCheck(
      `${instructionsFile} absent; the static kenkeep pointer block is missing (hook-injected session context is unaffected). Re-run \`npx kenkeep init --harnesses copilot --upgrade\`.`
    );
  }
  const text = readFileSync(instructionsFile, 'utf8');
  if (text.includes(SENTINEL_START) && text.includes(SENTINEL_END)) {
    return ok('static pointer block present');
  }
  return warnCheck(
    'kk:start/kk:end static pointer block missing (hook-injected session context is unaffected). Re-run `npx kenkeep init --harnesses copilot --upgrade`.'
  );
}
