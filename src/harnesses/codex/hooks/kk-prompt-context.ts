/**
 * UserPromptSubmit hook (sync) for the Codex CLI adapter.
 *
 * After the user's prompt is known, ranks the current on-disk leaf nodes against
 * it and injects a small, bounded summaries-plus-links block of the most
 * relevant nodes. This is the prompt-time complement to the SessionStart
 * `ENTRY.md` orientation injection; both surfaces coexist.
 *
 * Output format: Codex's `UserPromptSubmit` JSON contract —
 * `{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }`.
 * Registered WITHOUT async so stdout reaches the session.
 *
 * Bounded and fail-open: a short hard deadline guards the prompt path, and any
 * missing prompt, missing/empty/malformed knowledge base, or error yields no
 * injected context (the hook exits 0 with no stdout). The prompt text is never
 * logged or persisted.
 */
import {
  AdditionalContextEnvelopeStrategy,
  runPromptContextHook,
} from '../../../lib/prompt-context-hook.js';

class CodexPromptContext extends AdditionalContextEnvelopeStrategy {
  readonly tag = 'codex:kk-prompt-context';

  /** Codex may invoke the hook without a JSON payload; that is expected. */
  override invalidJson(): 'diagnostic' | 'ignore' {
    return 'ignore';
  }
}

runPromptContextHook(new CodexPromptContext());
