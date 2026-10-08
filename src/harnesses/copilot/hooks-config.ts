import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { atomicWriteFile } from '../../lib/fs-atomic.js';
import { splitManagedBlock } from '../../lib/managed-block.js';
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
 * Builds the hook `bash` command for one script. The hook config is
 * repo-level (`.github/hooks/kk.json`), but Copilot runs each command with
 * the SESSION's cwd, which may be a subdirectory of the repo. The
 * walk-up-from-`$PWD` command resolves the session repo's own
 * `.ai/kenkeep/hooks/copilot/<script>` and `exec`s it, so:
 *   - sessions started in a repo subdirectory still find the hooks;
 *   - the config carries no per-repo absolute path, so it stays
 *     byte-identical and portable across machines (a checkout at a
 *     different path just works);
 *   - sessions outside any kenkeep repo no-op silently.
 * `exec` keeps stdin (the hook payload JSON) flowing to the node process.
 */
function walkUpCommand(scriptPath: string): string {
  const rel = `.ai/kenkeep/hooks/copilot/${scriptPath}`;
  return `d="$PWD"; while [ "$d" != "/" ]; do s="$d/${rel}"; [ -f "$s" ] && exec node "$s"; d="$(dirname "$d")"; done; :`;
}

/**
 * Renders the aggregated `{ version, hooks }` Copilot hook document from
 * `copilotHookSpecs`. Each entry's `bash` command resolves the script via
 * `walkUpCommand`; the `payload` blob supplies `type`, `timeoutSec`, and
 * optionally `env`/`cwd`. Entries are grouped by event in declaration order
 * so the output is deterministic.
 */
function renderHookConfig(): CopilotHookConfig {
  const hooks: Record<string, CopilotHookCommand[]> = {};
  for (const spec of copilotHookSpecs) {
    const payload = spec.payload ?? {};
    const type = typeof payload['type'] === 'string' ? (payload['type'] as string) : 'command';
    const timeoutSec =
      typeof payload['timeoutSec'] === 'number' ? (payload['timeoutSec'] as number) : 30;
    const cmd: CopilotHookCommand = {
      type,
      bash: walkUpCommand(spec.scriptPath),
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

/**
 * Renders the aggregated Copilot hook JSON and atomically writes it to the
 * **repo-level** file Copilot reads (`paths.settingsFile`, i.e.
 * `.github/hooks/kk.json`). Copilot CLI loads `.github/hooks/*.json`
 * before user-level `~/.copilot/hooks/`, so this committed file is the
 * canonical registration: team-shared, no user-home write, no cross-repo
 * leakage. Idempotent: re-running produces identical bytes.
 */
export async function writeCopilotHookConfig(paths: HarnessPaths): Promise<void> {
  if (!paths.settingsFile) {
    throw new Error(
      'writeCopilotHookConfig requires paths.settingsFile (the repo-level .github/hooks/kk.json)'
    );
  }
  const config = renderHookConfig();
  const body = `${JSON.stringify(config, null, 2)}\n`;
  atomicWriteFile(paths.settingsFile, body);
}

/**
 * The static, team-shared block the installer keeps in the tracked
 * `.github/copilot-instructions.md`. It only points at the entry catalog
 * and names the private channel that carries the live content: the
 * `sessionStart` hook's stdout `additionalContext`, which Copilot CLI injects
 * into the session (hooks reference; CLI 1.0.11+). Byte-identical for every
 * user and every run, so it never carries a hostname, queue counts or the
 * nudge directive and never dirties the committed file. The descent directive
 * itself is not repeated here: the hook injects it with the catalog, and the
 * AGENTS.md pointer block (which Copilot also reads) already carries it.
 */
export const COPILOT_INSTRUCTIONS_POINTER = [
  'You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry catalog for this repo. Enter there and descend using progressive disclosure principles.',
  '',
  'The kenkeep `sessionStart` hook registered in `.github/hooks/kk.json` injects the live catalog, its navigation directive and the curation status into each session as `additionalContext`. This block is static and safe to commit; it never carries per-user session state.',
].join('\n');

/**
 * Builds the file body with exactly one sentinel block at the end, carrying
 * `blockContent`. Any content outside an existing block is preserved; an
 * existing block is replaced in place. When no block exists the new block is
 * appended after the existing content. Marker detection follows the shared
 * malformed-sentinel policy (`managed-block.ts`): orphaned, duplicated or
 * reversed markers throw a `MalformedManagedBlockError` naming `file` instead
 * of rewriting it.
 */
function withSentinelBlock(existing: string, blockContent: string, file: string): string {
  const block = `${SENTINEL_START}\n${blockContent}\n${SENTINEL_END}`;
  const split = splitManagedBlock(existing, { start: SENTINEL_START, end: SENTINEL_END }, file);
  if (split.found) {
    const trimmedBefore = split.before.replace(/\s+$/, '');
    // Trim both ends: the tail is re-terminated below, so a kept trailing
    // newline would grow by one on every run (the file was not idempotent).
    const trimmedAfter = split.after.trim();
    const head = trimmedBefore.length > 0 ? `${trimmedBefore}\n\n` : '';
    const tail = trimmedAfter.length > 0 ? `\n\n${trimmedAfter}` : '';
    return `${head}${block}${tail}\n`;
  }
  const base = existing.replace(/\s+$/, '');
  if (base.length === 0) return `${block}\n`;
  return `${base}\n\n${block}\n`;
}

/**
 * Idempotently writes the static kenkeep pointer block
 * (`COPILOT_INSTRUCTIONS_POINTER`) into `<root>/.github/copilot-instructions.md`,
 * the repo-wide instructions file Copilot reads. Called by install and
 * `init --upgrade` only, never by a hook: the live catalog and per-user
 * state go through the sessionStart hook's `additionalContext`. A legacy
 * catalog-carrying block is replaced in place on upgrade. User-authored
 * content outside the block is preserved verbatim. The write is atomic and
 * skipped when the resulting content is byte-identical to the existing file
 * (no mtime churn). The repo root is the parent of `paths.dir`
 * (`<root>/.github`).
 */
export async function writeCopilotInstructionsSentinel(paths: HarnessPaths): Promise<void> {
  const repoRoot = dirname(paths.dir);
  const instructionsFile = join(repoRoot, '.github', 'copilot-instructions.md');
  const existing = existsSync(instructionsFile) ? readFileSync(instructionsFile, 'utf8') : '';
  const next = withSentinelBlock(existing, COPILOT_INSTRUCTIONS_POINTER, instructionsFile);
  if (next === existing) return;
  atomicWriteFile(instructionsFile, next);
}
