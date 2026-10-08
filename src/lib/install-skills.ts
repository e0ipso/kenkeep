import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { errCheck, ok, type DoctorCheckResult } from '../harnesses/types.js';

/**
 * The shared skills every adapter installs. Single source of truth for the
 * per-adapter doctor checks. Must match the directories under
 * `src/templates-source/skills/`.
 */
export const EXPECTED_SKILLS = [
  'kk-add',
  'kk-bootstrap',
  'kk-curate',
  'kk-migrate',
  'kk-session-extract',
] as const;

/**
 * Copies the shared SKILL.md tree at `templates/skills/` into the given
 * destination directory, overwriting what is there. The same bytes land in
 * every configured harness's native skills location; each skill resolves the
 * repo root at runtime through the shipped `.ai/kenkeep/scripts/kk-detect-root.mjs`.
 *
 * Called by every adapter's install/upgrade flow. No-ops when the source
 * tree is missing (e.g. during partial dev builds).
 */
export function installSharedSkills(templatesDir: string, skillsDir: string): void {
  const src = join(templatesDir, 'skills');
  if (!existsSync(src)) return;
  mkdirSync(skillsDir, { recursive: true });
  cpSync(src, skillsDir, { recursive: true, force: true });
}

/** Expected skills whose `SKILL.md` is absent from `skillsDir` (all, when the directory is missing). */
export function missingSharedSkills(skillsDir: string): string[] {
  return EXPECTED_SKILLS.filter(name => !existsSync(join(skillsDir, name, 'SKILL.md')));
}

/**
 * Doctor check for one adapter's shared skills directory. `dirLabel` is the
 * repo-relative directory the adapter installs into (for the message only).
 */
export function sharedSkillsDoctorCheck(
  skillsDir: string,
  dirLabel: string,
  harnessId: string
): DoctorCheckResult {
  if (!existsSync(skillsDir)) {
    return errCheck(
      `no ${dirLabel} directory. Re-run \`npx kenkeep init --harnesses ${harnessId} --upgrade\`.`
    );
  }
  const missing = missingSharedSkills(skillsDir);
  return missing.length === 0
    ? ok(EXPECTED_SKILLS.join(', '))
    : errCheck(
        `missing SKILL.md for: ${missing.join(', ')}. Re-run \`npx kenkeep init --harnesses ${harnessId} --upgrade\`.`
      );
}
