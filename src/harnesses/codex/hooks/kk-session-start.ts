/**
 * SessionStart hook (sync) for the Codex CLI adapter.
 *
 * Emits the current `ENTRY.md` body (plus the standard staleness and nudge
 * lines) as Codex's documented additionalContext payload.
 *
 * Output format: Codex's `SessionStart` JSON contract —
 * `{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }`.
 */
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';

class CodexSessionStart extends SessionStartStrategy {
  readonly tag = 'codex:kk-session-start';

  emit({ content }: SessionStartEmit): void {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: content,
        },
      })}\n`
    );
  }

  /** Codex may invoke the hook without a JSON payload; that is expected. */
  override invalidJson(): 'diagnostic' | 'ignore' {
    return 'ignore';
  }
}

runSessionStartHook(new CodexSessionStart());
