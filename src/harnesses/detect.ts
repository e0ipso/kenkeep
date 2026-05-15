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

/**
 * Hint-aware resolution chain shared between the CLI and the
 * `/tmp/kb-detect-harness.mjs` skill helper. Priority:
 *
 *   1. `hint`, when supplied and registered. An unknown hint falls through
 *      silently so a typo does not silently select the wrong adapter; the
 *      caller may end up at the env / configDefault paths instead.
 *   2. Env detection (`adapter.detectFromEnv` in registry order; first
 *      truthy match wins).
 *   3. `configDefault`, when supplied and registered.
 *   4. Throw with a message naming `--hint` and `cliDefaultHarness`.
 *
 * Hint wins over env so a user invoking from inside an OpenCode session
 * with Claude installed globally can still target OpenCode by passing the
 * hint explicitly (`session.idle` env carries no OpenCode signal, but
 * `CLAUDECODE=1` might leak in from the parent shell).
 *
 * The TS implementation here is mirrored by the heredoc in
 * `src/templates-source/skills/kb-curate/SKILL.md`. CI guards drift
 * between the two via `scripts/lint-detect-harness.mjs`.
 */
export function resolveWithHint(
  env: NodeJS.ProcessEnv = process.env,
  hint?: string,
  configDefault?: string
): HarnessAdapter {
  if (hint !== undefined && hasHarness(hint)) {
    return getHarness(hint);
  }
  const detected = detectHarnessFromEnv(env);
  if (detected) return detected;
  if (configDefault !== undefined && hasHarness(configDefault)) {
    return getHarness(configDefault);
  }
  throw new Error(
    `Could not resolve active harness. Pass --hint <id> or set ` +
      `cliDefaultHarness in .ai/knowledge-base/config.yaml. ` +
      `Available: ${listHarnessIds().join(', ') || '(none)'}.`
  );
}

export interface ResolveActiveHarnessOpts {
  /**
   * Explicit `--harness <id>` flag value, if the user supplied one.
   * Highest-priority signal: when set and valid, it is returned
   * unconditionally; when set and unknown, the call throws.
   */
  flag?: string | undefined;
  /** Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /**
   * The `cliDefaultHarness` value read from `config.yaml`. Only used
   * when neither `flag` nor env detection produced a match. Skills and
   * hooks are always invoked from inside their host harness, where env
   * detection succeeds and this value is ignored.
   */
  cliDefault?: string | undefined;
}

/**
 * Resolves the harness that owns the current process.
 *
 * Resolution order (strict):
 *
 *   1. **`--harness <id>` flag.** Highest priority. Skills and hook
 *      scripts always pass this so the harness identity is explicit and
 *      portable across shells with no harness-detectable env. An
 *      unregistered id throws.
 *   2. **Env detection.** Each registered adapter's `detectFromEnv` is
 *      asked in turn; the first match wins. Used when the CLI runs
 *      inside a harness session that exports a known env var (Claude
 *      sets `CLAUDECODE=1` and `CLAUDE_PROJECT_DIR`).
 *   3. **`cliDefaultHarness` from config.yaml.** Plain-shell CLI
 *      invocations (e.g. `npx ai-knowledge-base curate` typed in a
 *      terminal) fall through to this setting.
 *   4. **First registered harness.** Final fallback so the CLI keeps
 *      working in a brand-new repo without `cliDefaultHarness` set.
 *
 * This is the single entry point CLI commands use to pick an adapter.
 * `init` takes its harness list from the `--harnesses` flag and
 * bypasses this function.
 */
export function resolveActiveHarness(opts: ResolveActiveHarnessOpts = {}): HarnessAdapter {
  const env = opts.env ?? process.env;

  if (opts.flag) {
    if (!hasHarness(opts.flag)) {
      throw new Error(
        `Unsupported harness '${opts.flag}'. Supported: ${listHarnessIds().join(', ') || '(none)'}.`
      );
    }
    return getHarness(opts.flag);
  }

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
