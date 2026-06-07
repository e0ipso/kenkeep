import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { KK_NAVIGATION_DIRECTIVE } from '../../lib/session-start.js';
import type { HarnessPaths } from '../types.js';
import { copilotHookSpecs } from './hook-spec.js';

/** Schema version Copilot expects at the top of its hook config document. */
const HOOK_CONFIG_VERSION = 1;

/** Sentinel markers wrapping the kenkeep-managed block in the instructions file. */
export const SENTINEL_START = '<!-- kk:start -->';
export const SENTINEL_END = '<!-- kk:end -->';

/**
 * Resolves the user-level Copilot home directory. Copilot reads its hook
 * config from `${COPILOT_HOME:-~/.copilot}/hooks/`; honoring `COPILOT_HOME`
 * keeps the adapter aligned with a non-default install location.
 */
export function copilotHome(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['COPILOT_HOME'];
  if (explicit && explicit.length > 0) return explicit;
  return join(homedir(), '.copilot');
}

interface CopilotHookCommand {
  type: string;
  bash: string;
  timeoutSec: number;
  env?: Record<string, string>;
  cwd?: string;
}

interface CopilotHookConfig {
  version: number;
  hooks: Record<string, CopilotHookCommand[]>;
}

/**
 * Renders the aggregated `{ version, hooks }` Copilot hook document from
 * `copilotHookSpecs`. Each entry's `bash` command is `node <abs-script>`
 * where the script lives under `<dir>/kk-hooks/`; the `payload` blob
 * supplies `type`, `timeoutSec`, and `env`. Entries are grouped by event in
 * declaration order so the output is deterministic.
 */
function renderHookConfig(kkHooksDir: string): CopilotHookConfig {
  const hooks: Record<string, CopilotHookCommand[]> = {};
  for (const spec of copilotHookSpecs) {
    const payload = spec.payload ?? {};
    const type = typeof payload['type'] === 'string' ? (payload['type'] as string) : 'command';
    const timeoutSec =
      typeof payload['timeoutSec'] === 'number' ? (payload['timeoutSec'] as number) : 30;
    const cmd: CopilotHookCommand = {
      type,
      bash: `node ${join(kkHooksDir, spec.scriptPath)}`,
      timeoutSec,
    };
    const env = payload['env'];
    if (env && typeof env === 'object') {
      cmd.env = env as Record<string, string>;
    }
    const cwd = payload['cwd'];
    if (typeof cwd === 'string') cmd.cwd = cwd;
    (hooks[spec.event] ??= []).push(cmd);
  }
  return { version: HOOK_CONFIG_VERSION, hooks };
}

/** Atomic write: tmp file then rename. Creates the parent directory. */
function atomicWriteText(file: string, body: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}

/**
 * Renders the aggregated Copilot hook JSON and atomically writes it to both
 * the user-level file Copilot reads (`paths.settingsFile`, i.e.
 * `~/.copilot/hooks/kk.json`) and the in-repo documentation artifact
 * (`<paths.hooksDir>/kk.json`). Both files are byte-identical. Idempotent:
 * re-running produces identical bytes.
 */
export async function writeCopilotHookConfig(paths: HarnessPaths): Promise<void> {
  const kkHooksDir = join(paths.dir, 'kk-hooks');
  const config = renderHookConfig(kkHooksDir);
  const body = `${JSON.stringify(config, null, 2)}\n`;

  const projectFile = join(paths.hooksDir ?? join(paths.dir, 'hooks'), 'kk.json');
  atomicWriteText(projectFile, body);
  if (paths.settingsFile) {
    atomicWriteText(paths.settingsFile, body);
  }
}

/**
 * Reads the current INDEX content the sentinel block should carry. The
 * INDEX lives at `<root>/.ai/kenkeep/INDEX.md`; the repo root is the parent
 * of `paths.dir` (`<root>/.copilot`). Falls back to a short placeholder when
 * INDEX.md is absent (a fresh repo before the first index rebuild).
 */
function readIndexContent(repoRoot: string): string {
  const indexFile = join(repoRoot, '.ai', 'kenkeep', 'INDEX.md');
  if (existsSync(indexFile)) {
    // INDEX.md is the root index node (the top-level catalog of branches and
    // root-level leaves). Pair it with the shared descent directive so Copilot
    // gets the same enter-at-the-root, descend-on-demand guidance as the other
    // adapters, sourced from the one KK_NAVIGATION_DIRECTIVE constant.
    const body = readFileSync(indexFile, 'utf8').trimEnd();
    return `${body}\n\n${KK_NAVIGATION_DIRECTIVE}`;
  }
  return 'Curated project knowledge lives in .ai/kenkeep/INDEX.md (not yet generated). Run `npx kenkeep index rebuild` to populate it.';
}

/**
 * Builds the file body with exactly one sentinel block at the end, carrying
 * `indexContent`. Any content outside an existing block is preserved; an
 * existing block is replaced in place. When no block exists the new block is
 * appended after the existing content.
 */
function withSentinelBlock(existing: string, indexContent: string): string {
  const block = `${SENTINEL_START}\n${indexContent}\n${SENTINEL_END}`;
  const startIdx = existing.indexOf(SENTINEL_START);
  const endIdx = existing.indexOf(SENTINEL_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + SENTINEL_END.length);
    const trimmedBefore = before.replace(/\s+$/, '');
    const trimmedAfter = after.replace(/^\s+/, '');
    const head = trimmedBefore.length > 0 ? `${trimmedBefore}\n\n` : '';
    const tail = trimmedAfter.length > 0 ? `\n\n${trimmedAfter}` : '';
    return `${head}${block}${tail}\n`;
  }
  const base = existing.replace(/\s+$/, '');
  if (base.length === 0) return `${block}\n`;
  return `${base}\n\n${block}\n`;
}

/**
 * Idempotently injects the kenkeep INDEX sentinel block into
 * `<root>/.github/copilot-instructions.md`. Copilot reads that file on
 * session start, so the sentinel block is the v1 channel for session-start
 * context injection. User-authored content outside the block is preserved
 * verbatim. The write is atomic and skipped when the resulting content is
 * byte-identical to the existing file (no mtime churn).
 */
export async function writeCopilotInstructionsSentinel(paths: HarnessPaths): Promise<void> {
  const repoRoot = dirname(paths.dir);
  const instructionsFile = join(repoRoot, '.github', 'copilot-instructions.md');
  const existing = existsSync(instructionsFile) ? readFileSync(instructionsFile, 'utf8') : '';
  const indexContent = readIndexContent(repoRoot);
  const next = withSentinelBlock(existing, indexContent);
  if (next === existing) return;
  atomicWriteText(instructionsFile, next);
}
