import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  parseJsonLine,
  prepareHeadlessPrompt,
  spawnHeadless,
  validateHeadlessJson,
} from '../../lib/headless-runner.js';
import { CodexHarnessOptsSchema, codexModelArgs } from './opts.js';

/**
 * Codex event-stream record shape. Codex documents
 * `thread.started`, `turn.started`, `item.started`, `item.completed`,
 * `turn.completed`, and `error`. We only consume `item.completed` events
 * whose nested `item.type === 'agent_message'` to recover the final
 * structured answer; everything else is forwarded to `onMessage` / logged
 * but does not influence the return value.
 */
interface CodexEvent extends HeadlessStreamMessage {
  type?: string;
  item?: {
    type?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/**
 * Invokes `codex exec --json` and validates the final agent message as
 * structured JSON against `schema`. Each stdout line is a JSON event;
 * events are mirrored to `opts.logFile` (if given), surfaced via
 * `opts.onMessage`, and used to track the most recent `agent_message`.
 * The final agent message's `text` field is parsed as JSON after the
 * child exits.
 *
 * Transport: a prompt within `PROMPT_STDIN_THRESHOLD` is the positional
 * `[PROMPT]`; a larger one is piped to stdin behind the documented `-`
 * placeholder (`codex exec --help`, 0.159.3: "If not provided as an argument
 * (or if `-` is used), instructions are read from stdin").
 *
 * Codex-specific knobs (`model`, `reasoningEffort`) live inside the
 * adapter-opaque `harnessOpts` blob and are validated by
 * `CodexHarnessOptsSchema` at the top of the call.
 */
export async function runHeadlessCodex<T>(
  promptBody: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const harnessOpts = CodexHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const prompt = prepareHeadlessPrompt(promptBody);

  const args: string[] = ['exec', '--json', '--sandbox', 'read-only'];
  // codex refuses to start outside a trusted git repository. A caller that set
  // an explicit cwd did so to escape repository context on purpose (see the
  // prompt evaluation sandbox), so waive the check for that case only.
  if (opts.cwd) args.push('--skip-git-repo-check');
  args.push(...codexModelArgs(harnessOpts.model, harnessOpts.reasoningEffort));
  args.push(...(prompt.transport === 'stdin' ? ['-'] : prompt.positional));

  let lastAgentMessage: string | undefined;
  await spawnHeadless(
    {
      command: 'codex',
      args,
      input: prompt.input,
      label: 'codex',
      onLine: line => {
        const parsed = parseJsonLine<CodexEvent>(line);
        if (!parsed) return;
        if (
          parsed.type === 'item.completed' &&
          parsed.item &&
          parsed.item.type === 'agent_message' &&
          typeof parsed.item.text === 'string'
        ) {
          lastAgentMessage = parsed.item.text;
        }
        if (opts.onMessage) opts.onMessage(parsed);
      },
    },
    opts
  );

  if (typeof lastAgentMessage !== 'string') {
    throw new Error('codex subprocess produced no agent_message event');
  }
  return validateHeadlessJson(lastAgentMessage, schema, opts);
}
