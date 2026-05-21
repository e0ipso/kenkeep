import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';
import { atomicWriteJson } from '../../lib/fs-atomic.js';
import type { HookEvent, HookSpec } from '../types.js';

/**
 * Path prefix marker for hook commands owned by this package. Any
 * `hooks.json` entry whose command starts with this prefix is treated as
 * one of ours and is wholesale replaced on upgrade. Entries that do not
 * carry the marker (user-authored hooks) are preserved untouched.
 */
const OWNED_COMMAND_PREFIX = 'node ./.codex/hooks/kb-';

/**
 * Default per-hook timeout in seconds, applied to every command we
 * register in `.codex/hooks.json`. Codex enforces a per-hook timeout so a
 * runaway script cannot stall the session lifecycle.
 */
const DEFAULT_HOOK_TIMEOUT_SECONDS = 30;

/**
 * Stable documentation URL surfaced when the TOML coexistence guard
 * triggers. Documented in `docs/installation/codex-toml-hooks-coexistence.md`.
 */
const TOML_COEXISTENCE_DOCS_URL =
  'https://github.com/e0ipso/ai-knowledge-base/blob/main/docs/installation/codex-toml-hooks-coexistence.md';

const HookCommandSchema = z
  .object({
    type: z.string(),
    command: z.string(),
    timeout: z.number().optional(),
  })
  .passthrough();

const HookEntrySchema = z
  .object({
    matcher: z.string().optional(),
    hooks: z.array(HookCommandSchema),
  })
  .passthrough();

const CodexHooksFileSchema = z
  .object({
    hooks: z.record(z.array(HookEntrySchema)).optional(),
  })
  .passthrough();

export type CodexHookCommand = z.infer<typeof HookCommandSchema>;
export type CodexHookEntry = z.infer<typeof HookEntrySchema>;
export type CodexHooksFile = z.infer<typeof CodexHooksFileSchema>;

export interface CodexHookWritePaths {
  /** Absolute path to `.codex/`. */
  dir: string;
  /** Absolute path to `.codex/hooks.json`. */
  settingsFile: string;
  /** Absolute path to `.codex/config.toml` (may not exist). */
  configToml: string;
}

/**
 * Resolves the on-disk locations the writer reads from and writes to,
 * given a repository root. Centralizing this keeps `install.ts`,
 * `writeCodexHooks`, and `readCodexHooks` in lock-step.
 */
export function codexHookConfigPaths(repoRoot: string): CodexHookWritePaths {
  const dir = join(repoRoot, '.codex');
  return {
    dir,
    settingsFile: join(dir, 'hooks.json'),
    configToml: join(dir, 'config.toml'),
  };
}

/**
 * Reads and validates `.codex/hooks.json` if it exists. Returns an empty
 * `{}` when the file is missing. Throws a clear error when the file is
 * present but unparseable or fails Zod validation, so a malformed file
 * never silently swallows or corrupts user-defined entries.
 */
export function readCodexHooks(paths: CodexHookWritePaths): CodexHooksFile {
  if (!existsSync(paths.settingsFile)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.settingsFile, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse existing ${paths.settingsFile}: ${(err as Error).message}`);
  }
  const parsed = CodexHooksFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Existing ${paths.settingsFile} does not match expected shape: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

/**
 * Aborts when `.codex/config.toml` declares its own `[hooks]` table. Mixing
 * inline TOML hooks with `hooks.json` is undefined behavior in Codex; we
 * fail loudly with a docs link instead of silently overwriting either.
 */
function guardAgainstTomlHooks(paths: CodexHookWritePaths): void {
  if (!existsSync(paths.configToml)) return;
  const text = readFileSync(paths.configToml, 'utf8');
  let parsed: unknown;
  try {
    parsed = parseToml(text);
  } catch (err) {
    throw new Error(`Could not parse ${paths.configToml}: ${(err as Error).message}`);
  }
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'hooks' in parsed &&
    typeof (parsed as { hooks: unknown }).hooks === 'object' &&
    (parsed as { hooks: object }).hooks !== null &&
    Object.keys((parsed as { hooks: Record<string, unknown> }).hooks).length > 0
  ) {
    throw new Error(
      `Refusing to write .codex/hooks.json: .codex/config.toml already defines [hooks].\nMerge our entries by hand: ${TOML_COEXISTENCE_DOCS_URL}`
    );
  }
}

/**
 * Merges hook entries into `.codex/hooks.json`. Existing user-defined
 * hooks are preserved; entries previously written by us are recognized by
 * the `node ./.codex/hooks/kb-` command prefix and replaced wholesale.
 *
 * Hook specs accepted here use Codex-relative script paths (e.g.
 * `.codex/hooks/kb-capture.cjs`). The caller of this function is
 * responsible for prefixing the harness directory before invoking it.
 */
export async function writeCodexHooks(
  repoRoot: string,
  hooks: Array<{ event: HookEvent; scriptPath: string; matcher?: string; async?: boolean }>
): Promise<void> {
  const paths = codexHookConfigPaths(repoRoot);
  guardAgainstTomlHooks(paths);

  const existing = readCodexHooks(paths);
  const hookTable: Record<string, CodexHookEntry[]> = { ...(existing.hooks ?? {}) };

  // Strip out previously-owned entries identified by the command prefix.
  for (const [event, entries] of Object.entries(hookTable)) {
    const filtered = entries
      .map(entry => ({
        ...entry,
        hooks: entry.hooks.filter(h => !h.command.startsWith(OWNED_COMMAND_PREFIX)),
      }))
      .filter(entry => entry.hooks.length > 0);
    if (filtered.length === 0) delete hookTable[event];
    else hookTable[event] = filtered;
  }

  for (const hook of hooks) {
    const list = (hookTable[hook.event] ??= []);
    const command = `node ./${hook.scriptPath}`;
    const cmd: CodexHookCommand = {
      type: 'command',
      command,
      timeout: DEFAULT_HOOK_TIMEOUT_SECONDS,
    };
    const entry: CodexHookEntry = { hooks: [cmd] };
    if (hook.matcher) entry.matcher = hook.matcher;
    list.push(entry);
  }

  const out: CodexHooksFile = { ...existing, hooks: hookTable };
  atomicWriteJson(paths.settingsFile, out);
}

export type { HookSpec };
