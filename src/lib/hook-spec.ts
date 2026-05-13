export type HookEvent = 'Stop' | 'SessionEnd' | 'PreCompact' | 'SessionStart' | 'UserPromptSubmit';

export interface HookSpec {
  event: HookEvent;
  scriptPath: string;
  async?: boolean;
}

export const HOOK_SPECS: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionEnd', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionEnd', scriptPath: 'kb-lint-tick.mjs', async: true },
  { event: 'PreCompact', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionStart', scriptPath: 'kb-proposal-drain.mjs', async: true },
  { event: 'SessionStart', scriptPath: 'kb-session-start.mjs' },
];
