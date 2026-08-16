import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoPaths } from '../../lib/paths.js';
import { EXPECTED_SKILLS } from '../../lib/install-skills.js';
import { sharedHookScriptPath } from '../../lib/shared-hooks.js';
import {
  errCheck,
  ok,
  warnCheck,
  type DoctorCheckResult,
  type NamedDoctorCheck,
} from '../types.js';
import { grokHookSpecs } from './hook-spec.js';
import { grokHome } from './session-files.js';
import { grokPaths } from './install.js';

const exec = promisify(execFile);

export async function grokDoctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]> {
  const locs = grokPaths(paths.root);
  return [
    { name: 'grok CLI on PATH', result: await checkGrokCli() },
    { name: 'Grok hooks registered', result: checkGrokHooks(locs.settingsFile) },
    { name: 'Grok hook scripts installed', result: checkGrokHookScripts(locs.hooksDir) },
    { name: 'Grok skills installed', result: checkGrokSkills(paths.root, locs.skillsDir) },
    { name: 'Grok folder trust', result: checkFolderTrust(paths.root) },
  ];
}

async function checkGrokCli(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await exec('grok', ['--version'], { timeout: 5000 });
    return ok(stdout.trim() || 'present');
  } catch (e) {
    return errCheck(
      `not runnable (${(e as Error).message.split('\n')[0]}); install Grok Build TUI and ensure \`grok\` is on PATH`
    );
  }
}

function checkGrokHooks(hookFile: string): DoctorCheckResult {
  if (!existsSync(hookFile)) {
    return errCheck(`no ${hookFile}. Run \`npx kenkeep init --harnesses grok --upgrade\`.`);
  }
  let parsed: { hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
  try {
    parsed = JSON.parse(readFileSync(hookFile, 'utf8')) as typeof parsed;
  } catch (e) {
    return errCheck(`unparseable ${hookFile}: ${(e as Error).message}`);
  }
  const eventTable = parsed.hooks ?? {};
  const requiredEvents = [...new Set(grokHookSpecs.map(s => s.event))];
  const missingEvents = requiredEvents.filter(ev => (eventTable[ev] ?? []).length === 0);
  const missingScripts = grokHookSpecs
    .filter(spec => {
      const expected = sharedHookScriptPath('grok', spec.scriptPath);
      return !(eventTable[spec.event] ?? []).some(group =>
        (group.hooks ?? []).some(
          entry => typeof entry?.command === 'string' && entry.command.includes(expected)
        )
      );
    })
    .map(spec => `${spec.event} -> ${sharedHookScriptPath('grok', spec.scriptPath)}`);
  const missing = [...missingEvents, ...missingScripts];
  if (missing.length > 0) {
    return errCheck(
      `missing hook entries for: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses grok --upgrade\`.`
    );
  }
  return ok(`entries present for ${requiredEvents.join(', ')}`);
}

function checkGrokHookScripts(hooksDir: string): DoctorCheckResult {
  const expected = [...new Set(grokHookSpecs.map(s => s.scriptPath))];
  const missing = expected.filter(name => !existsSync(join(hooksDir, name)));
  if (missing.length > 0) {
    return errCheck(
      `missing scripts under ${hooksDir}: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses grok --upgrade\`.`
    );
  }
  return ok(expected.join(', '));
}

function checkGrokSkills(root: string, grokSkillsDir: string): DoctorCheckResult {
  const claudeSkillsDir = join(root, '.claude', 'skills');
  const claudeComplete = EXPECTED_SKILLS.every(name =>
    existsSync(join(claudeSkillsDir, name, 'SKILL.md'))
  );
  const grokComplete = EXPECTED_SKILLS.every(name =>
    existsSync(join(grokSkillsDir, name, 'SKILL.md'))
  );
  if (claudeComplete && grokComplete) {
    return warnCheck(
      'kk-* skills exist under both .claude/skills/ and .grok/skills/; Grok will see both. Remove .grok/skills/kk-* and keep the Claude tree (unify).'
    );
  }
  if (claudeComplete) {
    return ok('using .claude/skills/ (Grok Claude-compat)');
  }
  if (grokComplete) {
    return ok(EXPECTED_SKILLS.join(', '));
  }
  return errCheck(
    `missing SKILL.md for kk-*. Re-run \`npx kenkeep init --harnesses grok --upgrade\` (or install the claude adapter).`
  );
}

/**
 * Best-effort parse of `~/.grok/trusted_folders.toml`. Project hooks are
 * silently skipped until `/hooks-trust`.
 */
export function isGrokFolderTrusted(root: string, tomlText: string): boolean {
  const blocks = tomlText.split(/\n(?=\[folders\.)/);
  for (const block of blocks) {
    const pathMatch = block.match(/^\[folders\."([^"]+)"\]/m);
    if (!pathMatch) continue;
    const folder = pathMatch[1] ?? '';
    if (!block.match(/^\s*trusted\s*=\s*true\s*$/m)) continue;
    if (root === folder || root.startsWith(`${folder}/`)) return true;
  }
  return false;
}

function checkFolderTrust(root: string): DoctorCheckResult {
  const trustFile = join(grokHome(), 'trusted_folders.toml');
  if (!existsSync(trustFile)) {
    return warnCheck(
      'no ~/.grok/trusted_folders.toml; project hooks will not run until you run `/hooks-trust` (or `grok --trust`) once in this repo.'
    );
  }
  let text: string;
  try {
    text = readFileSync(trustFile, 'utf8');
  } catch (e) {
    return warnCheck(`could not read ${trustFile}: ${(e as Error).message}`);
  }
  if (isGrokFolderTrusted(root, text)) {
    return ok('project folder is trusted');
  }
  return warnCheck(
    `this repo is not in ${trustFile}; Grok silently skips project hooks until \`/hooks-trust\`.`
  );
}
