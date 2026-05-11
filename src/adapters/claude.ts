import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ZodSchema } from 'zod';
import { runHeadlessClaude, type RunHeadlessOptions } from '../lib/headless.js';
import { parseTranscriptJsonl } from '../lib/transcript.js';
import type {
  Adapter,
  HeadlessOpts,
  HookSpec,
  RoleTaggedTranscript,
  SkillSpec,
} from './types.js';

interface ClaudeSettings {
  hooks?: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> }>
  >;
  [key: string]: unknown;
}

export class ClaudeAdapter implements Adapter {
  readonly name = 'claude';

  hookInstallPath(): string {
    return '.claude/hooks';
  }

  skillInstallPath(): string {
    return '.claude/skills';
  }

  /**
   * Merges hook entries into `.claude/settings.json`. Existing user-defined
   * hooks are preserved; entries previously written by us are recognized by
   * the `KB_BUILDER_HOOK` marker in the command string and replaced wholesale.
   */
  async writeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void> {
    const settingsFile = join(repoRoot, '.claude/settings.json');
    let settings: ClaudeSettings = {};
    if (existsSync(settingsFile)) {
      try {
        settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as ClaudeSettings;
      } catch (err) {
        throw new Error(`Could not parse existing ${settingsFile}: ${(err as Error).message}`);
      }
    }
    settings.hooks ??= {};

    // Strip any entries we previously wrote.
    for (const [event, entries] of Object.entries(settings.hooks)) {
      const filtered = entries
        .map((entry) => ({
          ...entry,
          hooks: entry.hooks.filter((h) => !h.command.includes('KB_BUILDER_HOOK')),
        }))
        .filter((entry) => entry.hooks.length > 0);
      if (filtered.length === 0) delete settings.hooks[event];
      else settings.hooks[event] = filtered;
    }

    for (const hook of hooks) {
      const entryList = (settings.hooks[hook.event] ??= []);
      const command = `KB_BUILDER_HOOK=${hook.event} node ${hook.scriptPath}`;
      const entry: {
        matcher?: string;
        hooks: Array<{ type: string; command: string; async?: boolean }>;
      } = {
        hooks: [{ type: 'command', command, ...(hook.async ? { async: true } : {}) }],
      };
      if (hook.matcher) entry.matcher = hook.matcher;
      entryList.push(entry);
    }

    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
  }

  /**
   * Reads a Claude Code hook input and returns a role-tagged transcript.
   * The hook input is expected to carry a `transcript_path` pointing at
   * the JSONL session file on disk; we parse only user/assistant text
   * messages, dropping tool calls and system events.
   */
  async readTranscript(hookInput: unknown): Promise<RoleTaggedTranscript> {
    const input = hookInput as { transcript_path?: unknown } | null;
    const path = input && typeof input.transcript_path === 'string' ? input.transcript_path : null;
    if (!path) {
      throw new Error('hook input is missing transcript_path');
    }
    if (!existsSync(path)) {
      throw new Error(`transcript file not found: ${path}`);
    }
    const text = readFileSync(path, 'utf8');
    return parseTranscriptJsonl(text);
  }

  async runHeadless<T>(
    promptBody: string,
    stdin: string,
    schema: ZodSchema<T>,
    opts?: HeadlessOpts,
  ): Promise<T> {
    const runOpts: RunHeadlessOptions = {};
    if (opts?.timeoutMs !== undefined) runOpts.timeoutMs = opts.timeoutMs;
    if (opts?.allowedTools !== undefined) runOpts.allowedTools = opts.allowedTools;
    if (opts?.logFile !== undefined) runOpts.logFile = opts.logFile;
    return runHeadlessClaude(promptBody, stdin, schema, runOpts);
  }

  renderSkill(spec: SkillSpec): string {
    // Claude Code skills are directories containing a SKILL.md file with
    // YAML frontmatter (name, description, optional allowed-tools) and a
    // markdown body. This method returns the SKILL.md contents only; the
    // caller is responsible for writing it under `<skillInstallPath()>/<name>/`.
    const frontmatter = [
      `name: ${spec.name}`,
      `description: ${JSON.stringify(spec.description)}`,
    ];
    if (spec.allowedTools !== undefined) {
      frontmatter.push(`allowed-tools: ${spec.allowedTools}`);
    }
    return `---\n${frontmatter.join('\n')}\n---\n\n${spec.body.trim()}\n`;
  }
}
