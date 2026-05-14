import { getHarness, hasHarness, listHarnessIds } from './registry.js';
import type { HarnessAdapter } from './types.js';

/**
 * Walks every registered adapter and returns the first one whose
 * `detectFromEnv` predicate matches the given environment. Returns
 * `null` when nothing claims the env (e.g. running the CLI from a
 * plain shell with no session-specific env vars).
 */
export function detectHarnessFromEnv(env: NodeJS.ProcessEnv = process.env): HarnessAdapter | null {
  for (const id of listHarnessIds()) {
    const adapter = getHarness(id);
    if (adapter.detectFromEnv?.(env)) return adapter;
  }
  return null;
}

export interface ResolveActiveHarnessOpts {
  /** Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /**
   * The `cliDefaultHarness` value read from `config.yaml`. Only used
   * when env detection finds no match — i.e. the CLI was invoked from
   * a plain shell outside any assistant session. Skills and hooks are
   * always invoked from inside their host assistant, where env
   * detection succeeds and this value is ignored.
   */
  cliDefault?: string | undefined;
}

/**
 * Resolves the harness that owns the current process.
 *
 * Resolution order (strict):
 *
 *   1. **Env detection.** Each registered adapter's `detectFromEnv` is
 *      asked in turn; the first match wins. This is the path skills
 *      and hooks take, because their host assistant always sets a
 *      detectable env var (`CLAUDECODE=1`, `CLAUDE_PROJECT_DIR`, …).
 *      Skills therefore use the harness they were invoked from, never
 *      a configured default.
 *   2. **`cliDefaultHarness` from config.yaml.** Plain-shell CLI
 *      invocations (e.g. `npx ai-knowledge-base curate` typed in a
 *      terminal) fall through to this setting. Skills and hooks never
 *      reach this branch.
 *   3. **First registered harness.** Final fallback so the CLI keeps
 *      working in a brand-new repo without `cliDefaultHarness` set.
 *      In v1 this is always `claude`.
 *
 * This is the single entry point CLI commands use to pick an adapter.
 * `init` takes its harness list from the `--assistants` flag and
 * bypasses this function.
 */
export function resolveActiveHarness(opts: ResolveActiveHarnessOpts = {}): HarnessAdapter {
  const env = opts.env ?? process.env;

  const detected = detectHarnessFromEnv(env);
  if (detected) return detected;

  if (opts.cliDefault) {
    if (!hasHarness(opts.cliDefault)) {
      throw new Error(
        `config.yaml \`cliDefaultHarness: ${opts.cliDefault}\` is not a registered harness. ` +
          `Available: ${listHarnessIds().join(', ') || '(none)'}.`
      );
    }
    return getHarness(opts.cliDefault);
  }

  const ids = listHarnessIds();
  const first = ids[0];
  if (!first) throw new Error('no harness adapters registered');
  return getHarness(first);
}
