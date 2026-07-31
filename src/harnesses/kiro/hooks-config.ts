import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { KIRO_HOOK_SPECS } from './hook-spec.js';

/**
 * The filename of the kenkeep-managed Kiro agent hooks config.
 * Lives under `.kiro/agents/` alongside any other project-local agent
 * configs. Using a dedicated file keeps kenkeep's hooks isolated from the
 * user's own agent configs — no merging, no conflict on upgrade.
 */
export const KIRO_HOOKS_AGENT_FILE = 'kk-hooks.json';

/**
 * Builds the walk-up shell command for one hook script.
 *
 * The agent config is committed to the repo (`.kiro/agents/kk-hooks.json`),
 * but Kiro runs each command with the SESSION's cwd, which may be a
 * subdirectory. The walk-up command resolves the nearest `.ai/kenkeep/hooks/
 * kiro/<script>` above the session cwd and execs it, so:
 *   - sessions started in a repo subdirectory still find the scripts;
 *   - the config carries no per-machine absolute path (portable);
 *   - sessions outside any kenkeep repo no-op silently.
 * `exec` keeps stdin (the hook payload JSON) flowing to the node process.
 */
function walkUpCommand(scriptPath: string): string {
  const rel = `.ai/kenkeep/hooks/kiro/${scriptPath}`;
  return `d="$PWD"; while [ "$d" != "/" ]; do s="$d/${rel}"; [ -f "$s" ] && exec node "$s"; d="$(dirname "$d")"; done; :`;
}

/**
 * Kiro hook config shape. Kiro reads `.kiro/agents/*.json` on startup; each
 * file is an agent config. kenkeep writes a hooks-only agent (no `name`,
 * no `prompt`, no `tools`) that registers the lifecycle hooks alongside
 * the user's own agents.
 */
interface KiroHooksConfig {
  /** Identifies this as a kenkeep-managed file. Documentation only. */
  description: string;
  hooks: Record<string, Array<{ command: string; timeout?: number }>>;
}

/**
 * Renders the `kk-hooks.json` agent config from `KIRO_HOOK_SPECS`.
 *
 * Hooks are grouped by event. Each entry's command resolves the script via
 * `walkUpCommand`. A 60s timeout is set on every entry so a stuck script
 * can't block session start/stop indefinitely.
 */
function renderHooksConfig(): KiroHooksConfig {
  const hooks: Record<string, Array<{ command: string; timeout?: number }>> = {};
  for (const spec of KIRO_HOOK_SPECS) {
    const entry = {
      command: walkUpCommand(spec.scriptPath),
      timeout: 60,
    };
    (hooks[spec.event] ??= []).push(entry);
  }
  return {
    description:
      'kenkeep lifecycle hooks — managed by `npx kenkeep init --harnesses kiro`. Do not edit manually.',
    hooks,
  };
}

/** Atomic write: tmp file then rename. Creates the parent directory. */
function atomicWriteText(file: string, body: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}

/**
 * Renders the aggregated Kiro hooks agent config and atomically writes it to
 * `.kiro/agents/kk-hooks.json`. Idempotent: re-running produces identical
 * bytes when the hook specs have not changed.
 *
 * The file is committed to the repo alongside other project-local agent
 * configs. It does not touch the user's own agent configs.
 */
export function writeKiroHookConfig(root: string): void {
  const config = renderHooksConfig();
  const body = `${JSON.stringify(config, null, 2)}\n`;
  const file = join(root, '.kiro', 'agents', KIRO_HOOKS_AGENT_FILE);
  // Skip the write when the file already exists and the content is identical.
  if (existsSync(file)) {
    try {
      if (readFileSync(file, 'utf8') === body) return;
    } catch {
      // Fall through to overwrite.
    }
  }
  atomicWriteText(file, body);
}

/**
 * Checks whether `.kiro/agents/kk-hooks.json` exists and contains all
 * required hook entries. Returns null on success or an error string
 * describing what is missing.
 */
export function checkKiroHookConfig(root: string): string | null {
  const file = join(root, '.kiro', 'agents', KIRO_HOOKS_AGENT_FILE);
  if (!existsSync(file)) return `${file} not found`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return `${file} is not valid JSON`;
  }
  const hooks = (parsed as Record<string, unknown>)?.['hooks'];
  if (!hooks || typeof hooks !== 'object') return `${file} has no "hooks" field`;
  const hooksObj = hooks as Record<string, unknown>;
  const requiredEvents = [...new Set(KIRO_HOOK_SPECS.map(s => s.event))];
  const missingEvents = requiredEvents.filter(
    ev => !Array.isArray(hooksObj[ev]) || (hooksObj[ev] as unknown[]).length === 0
  );
  if (missingEvents.length > 0) {
    return `missing hook entries for events: ${missingEvents.join(', ')}`;
  }
  return null;
}
