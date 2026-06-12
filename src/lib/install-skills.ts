import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shared skills every adapter installs. Single source of truth for the
 * per-adapter doctor checks — the previous per-adapter copies of this list
 * had already drifted (every one omitted kk-migrate while init shipped it).
 * Must match the directories under `src/templates-source/skills/`.
 */
export const EXPECTED_SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate', 'kk-migrate'] as const;

/**
 * Copies the shared SKILL.md tree at `templates/skills/` into the
 * given destination directory. The same bytes land in every configured
 * harness's native skills location; harness-specific `--harness` values
 * are resolved at runtime by the heredoc helper embedded in each
 * SKILL.md body (`/tmp/kk-detect-harness.mjs`).
 *
 * Called by every adapter's install/upgrade flow. No-ops when the
 * source tree is missing (e.g. during partial dev builds).
 */
export function installSharedSkills(templatesDir: string, skillsDir: string): void {
  const src = join(templatesDir, 'skills');
  if (!existsSync(src)) return;
  mkdirSync(skillsDir, { recursive: true });
  cpSync(src, skillsDir, { recursive: true, force: true });
}
