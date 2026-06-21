// kenkeep opencode plugin
/**
 * OpenCode plugin shim. Subscribes to the runtime `event` hook and
 * dispatches each event to the matching per-event Node script under
 * `.ai/kenkeep/hooks/opencode/` via `child_process.spawn`.
 *
 * Recursion-guard layering: the plugin itself no-ops when
 * `KENKEEP_BUILDER_INTERNAL=1` is in its host env (a kenkeep-spawned
 * headless OpenCode session). The hook children are spawned WITHOUT the
 * guard — they carry the same check at their own entry point, so setting
 * it here would make every hook a no-op (no capture, no injection). Any
 * kenkeep process the hooks themselves spawn (`opencode export`, the
 * headless drain runner, skill launchers) sets the guard on its own child
 * at that boundary.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

interface OpenCodePluginInput {
  directory?: string;
  project?: { worktree?: string };
}

interface OpenCodeEvent {
  type?: string;
  properties?: { sessionID?: string };
}

const DISPATCH: Record<string, string[]> = {
  'session.created': ['kk-session-start.cjs', 'kk-proposal-drain.cjs'],
  'session.idle': ['kk-capture.cjs', 'kk-lint-tick.cjs'],
};

export default async (input: OpenCodePluginInput) => {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return {};
  const projectDir = input.directory ?? input.project?.worktree ?? process.cwd();
  const kkHooks = join(projectDir, '.ai', 'kenkeep', 'hooks', 'opencode');
  return {
    event: async ({ event }: { event: OpenCodeEvent }) => {
      if (!event.type) return;
      const scripts = DISPATCH[event.type];
      if (!scripts) return;
      const payload = JSON.stringify({
        session_id: event.properties?.sessionID,
        hook_event_name: event.type === 'session.created' ? 'SessionCreated' : 'SessionIdle',
        cwd: projectDir,
      });
      for (const script of scripts) {
        const child = spawn('node', [join(kkHooks, script)], {
          env: process.env,
          stdio: ['pipe', 'inherit', 'inherit'],
        });
        if (child.stdin) {
          child.stdin.write(payload);
          child.stdin.end();
        }
      }
    },
  };
};
