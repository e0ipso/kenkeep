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
import { copilotHookSpecs } from './hook-spec.js';
import { copilotHome } from './hooks-config.js';
import { copilotPaths } from './install.js';

const exec = promisify(execFile);
const EXPECTED_SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate'];
const COPILOT_DOCS_URL = 'https://github.com/github/copilot-cli';
const SENTINEL_START = '<!-- kk:start -->';
const SENTINEL_END = '<!-- kk:end -->';

export async function copilotDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = copilotPaths(paths.root);
  return [
    { name: 'copilot CLI on PATH', result: await checkCopilotCli() },
    { name: 'Copilot auth', result: checkCopilotAuth() },
    { name: 'Copilot hooks registered', result: checkCopilotHooks() },
    { name: 'Copilot hook scripts installed', result: checkCopilotHookScripts(locs.kkHooksDir) },
    { name: 'Copilot skills installed', result: checkCopilotSkills(locs.skillsDir) },
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

function checkCopilotHooks(): DoctorCheckResult {
  const hookFile = join(copilotHome(), 'hooks', 'kk.json');
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
  const missing = requiredEvents.filter(ev => (eventTable[ev] ?? []).length === 0);
  if (missing.length > 0) {
    return errCheck(
      `missing hook entries for: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses copilot --upgrade\`.`
    );
  }
  return ok(`entries present for ${requiredEvents.join(', ')}`);
}

function checkCopilotHookScripts(kkHooksDir: string): DoctorCheckResult {
  const expected = [...new Set(copilotHookSpecs.map(s => s.scriptPath))];
  const missing = expected.filter(name => !existsSync(join(kkHooksDir, name)));
  if (missing.length > 0) {
    return errCheck(
      `missing scripts under ${kkHooksDir}: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses copilot --upgrade\`.`
    );
  }
  return ok(expected.join(', '));
}

function checkCopilotSkills(skillsDir: string): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      'no .github/skills/ directory. Re-run `npx kenkeep init --harnesses copilot --upgrade`.'
    );
  }
  const missing = EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --upgrade\`.`
      );
}

function checkInstructionsSentinel(instructionsFile: string): DoctorCheckResult {
  if (!existsSync(instructionsFile)) {
    return warnCheck(
      `${instructionsFile} absent; session-start context injection inactive. Re-run \`npx kenkeep init --harnesses copilot --upgrade\`.`
    );
  }
  const text = readFileSync(instructionsFile, 'utf8');
  if (text.includes(SENTINEL_START) && text.includes(SENTINEL_END)) {
    return ok('sentinel block present');
  }
  return warnCheck(
    'kk:start/kk:end sentinel block missing; session-start context injection inactive.'
  );
}
