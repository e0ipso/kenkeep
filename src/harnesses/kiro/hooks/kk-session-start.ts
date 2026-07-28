/**
 * agentSpawn hook (sync) for the Kiro CLI adapter.
 *
 * Injects the current `ENTRY.md` body (plus staleness and nudge lines) as
 * additional context at session start. Kiro adds stdout to the agent's
 * context when the hook exits 0, making this equivalent to Claude's
 * `additionalContext` channel.
 *
 * Payload received on stdin:
 *   { hook_event_name: "agentSpawn", cwd: "...", session_id: "..." }
 *
 * Output: plain text on stdout (not JSON-wrapped — Kiro's `agentSpawn`
 * injects raw stdout into context, unlike Codex which wraps in
 * `hookSpecificOutput`).
 */
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';

class KiroSessionStart extends SessionStartStrategy {
  readonly tag = 'kiro:kk-session-start';

  /** Kiro injects raw stdout into the agent context on agentSpawn exit 0. */
  emit({ content }: SessionStartEmit): void {
    process.stdout.write(`${content}\n`);
  }
}

runSessionStartHook(new KiroSessionStart());
