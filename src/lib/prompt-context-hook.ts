/**
 * Strategy base for every adapter's `kk-prompt-context` hook.
 *
 * Prompt-time injection ranks the on-disk leaf nodes against the user's prompt
 * and hands a bounded summaries-plus-links block back to the host. The
 * ranking, the fail-open guards, and the privacy contract are identical on
 * every harness that supports it; only the delivery channel differs, so `emit`
 * is the sole abstract member.
 *
 * Bounded and fail-open throughout: a missing prompt, a repo that is not a
 * kenkeep project, and a missing/empty/malformed knowledge base all yield no
 * injected context (exit 0, no stdout). The prompt text is never logged or
 * persisted — keeping that guarantee in one place is the point of this module.
 */
import { existsSync } from 'node:fs';
import { hookStartCwd, payloadString, runHookEntry } from './hook-entry.js';
import { findRepoRoot, repoPaths } from './paths.js';
import { buildPromptKnowledgeContext } from './prompt-retrieval.js';

export abstract class PromptContextStrategy {
  /** Diagnostic tag, e.g. `'kiro:kk-prompt-context'`. */
  abstract readonly tag: string;

  /** Delivers the ranked context to the host. */
  abstract emit(context: string): void;

  /**
   * How a non-JSON payload is treated. Override to `'ignore'` on hosts where
   * an absent or malformed payload is expected rather than noteworthy.
   */
  invalidJson(): 'diagnostic' | 'ignore' {
    return 'diagnostic';
  }
}

/**
 * Strategy for hosts that read injected context from a
 * `hookSpecificOutput.additionalContext` JSON envelope on stdout — the shape
 * Claude defined and Codex adopted verbatim. Subclasses supply only their tag
 * (and Codex its payload tolerance), so the envelope literal exists once.
 */
export abstract class AdditionalContextEnvelopeStrategy extends PromptContextStrategy {
  emit(context: string): void {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: context,
        },
      })}\n`
    );
  }
}

/** Registers the prompt-time knowledge-injection hook for `strategy`. */
export function runPromptContextHook(strategy: PromptContextStrategy): void {
  runHookEntry({
    tag: strategy.tag,
    deadlineMs: 1000,
    invalidJson: strategy.invalidJson(),
    main: async payload => {
      const prompt = payloadString(payload, 'prompt') ?? '';
      if (prompt.trim().length === 0) return;
      const paths = repoPaths(findRepoRoot(hookStartCwd(payload)));
      if (!existsSync(paths.installedVersionFile)) return;

      let context: string;
      try {
        context = buildPromptKnowledgeContext(paths.nodesDir, prompt);
      } catch {
        // Fail open: a missing, empty, or malformed knowledge base never blocks
        // or perturbs the user's prompt.
        return;
      }
      if (context.trim().length === 0) return;
      strategy.emit(context);
    },
  });
}
