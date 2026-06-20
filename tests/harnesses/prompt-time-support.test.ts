import { describe, expect, it } from 'vitest';
import { getHarness } from '../../src/harnesses/registry.js';
import type { HookSpec } from '../../src/harnesses/types.js';

/**
 * Prompt-time injection is represented by an adapter declaring a native
 * prompt-submit `HookSpec` that runs the shared `kk-prompt-context` hook — there
 * is no global "prompt event" enum or translation. These assertions pin the
 * MVP support matrix: Claude and Codex are wired through their native
 * `UserPromptSubmit`; Cursor, OpenCode, and Copilot stay unregistered until a
 * verified native prompt-context channel exists.
 */
const PROMPT_CONTEXT_SCRIPT = 'kk-prompt-context.cjs';

function promptTimeHooks(id: string): HookSpec[] {
  return getHarness(id).hooks.filter(h => h.scriptPath === PROMPT_CONTEXT_SCRIPT);
}

describe('prompt-time injection support matrix', () => {
  it('Claude wires a synchronous UserPromptSubmit prompt-context hook', () => {
    const hooks = promptTimeHooks('claude');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.event).toBe('UserPromptSubmit');
    // A synchronous hook: async hooks have their stdout discarded and could not
    // inject context.
    expect(hooks[0]?.async).toBeUndefined();
  });

  it('Codex wires a synchronous UserPromptSubmit prompt-context hook', () => {
    const hooks = promptTimeHooks('codex');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.event).toBe('UserPromptSubmit');
    expect(hooks[0]?.async).toBeUndefined();
  });

  it('Cursor registers no prompt-time hook', () => {
    expect(promptTimeHooks('cursor')).toHaveLength(0);
  });

  it('OpenCode registers no prompt-time hook', () => {
    expect(promptTimeHooks('opencode')).toHaveLength(0);
  });

  it('Copilot registers no prompt-time hook and uses no userPromptSubmitted prompt injection', () => {
    expect(promptTimeHooks('copilot')).toHaveLength(0);
    // GitHub marks `userPromptSubmitted` output as not processed, so it must not
    // be repurposed as a prompt-injection channel.
    const promptSubmitEvents = getHarness('copilot').hooks.filter(
      h => h.event === 'userPromptSubmitted' || h.event === 'UserPromptSubmit'
    );
    expect(promptSubmitEvents).toHaveLength(0);
  });
});
