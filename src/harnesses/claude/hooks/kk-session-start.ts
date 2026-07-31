/**
 * SessionStart hook (sync) for the Claude Code adapter.
 *
 * Injects the current `ENTRY.md` body as additionalContext, optionally
 * appends a stale-entry warning, and optionally appends a curate nudge
 * when the pending-session backlog exceeds the threshold.
 *
 * Output format: a JSON object on stdout matching Claude Code's
 * `hookSpecificOutput.additionalContext` convention. Configured in
 * `.claude/settings.json` without `async: true` so stdout actually flows
 * back into the parent session.
 */
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';

class ClaudeSessionStart extends SessionStartStrategy {
  readonly tag = 'claude:kk-session-start';

  emit({ content, statusLine }: SessionStartEmit): void {
    process.stdout.write(
      `${JSON.stringify({
        systemMessage: statusLine,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: content,
        },
      })}\n`
    );
  }

  /** Claude surfaces the status line via the envelope's `systemMessage`. */
  override reportStatus(): void {}
}

runSessionStartHook(new ClaudeSessionStart());
