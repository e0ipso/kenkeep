/**
 * userPromptSubmit hook (sync) for the Kiro CLI adapter.
 *
 * After the user's prompt is known, ranks the on-disk leaf nodes against it
 * and injects a small, bounded summaries-plus-links block of the most
 * relevant nodes into the agent context. Kiro adds stdout to the agent's
 * context when the hook exits 0.
 *
 * Bounded and fail-open: any missing prompt, missing/empty/malformed knowledge
 * base, or error yields no injected context (exit 0, no stdout). The prompt
 * text is never logged or persisted.
 *
 * Payload received on stdin:
 *   { hook_event_name: "userPromptSubmit", cwd: "...", session_id: "...",
 *     prompt: "..." }
 *
 * Output: plain text on stdout (raw; Kiro injects stdout into context at
 * exit 0 for userPromptSubmit hooks).
 */
import { PromptContextStrategy, runPromptContextHook } from '../../../lib/prompt-context-hook.js';

class KiroPromptContext extends PromptContextStrategy {
  readonly tag = 'kiro:kk-prompt-context';

  /** Kiro injects raw stdout into the agent context for userPromptSubmit. */
  emit(context: string): void {
    process.stdout.write(`${context}\n`);
  }
}

runPromptContextHook(new KiroPromptContext());
