/**
 * Per-harness extractors that surface the file paths an agent accessed in a
 * harness's raw transcript. These feed knowledge-base usage tracking
 * (`src/lib/usage.ts` decides which paths are knowledge-base documents). Each
 * extractor returns paths in transcript/export order and preserves duplicates,
 * so repeated reads of the same file are counted repeatedly. Two signals count:
 * explicit file-open read tools (path taken directly from the tool input) and
 * markdown path candidates visibly named in shell/search command strings
 * (`cat`, `sed`, `head`, `rg`, `grep`, …) via `extractCommandMarkdownCandidates`.
 * Read-tool and command-derived candidates are interleaved in raw order. The
 * usage layer remains the authoritative filter for which candidates are actual
 * `.ai/kenkeep/nodes/` documents, so extraction stays broad and never executes
 * commands, expands globs, parses stdout, or reads arbitrary prose. Every
 * extractor is defensive: malformed lines and unrecognized shapes yield no
 * entries rather than throwing, so usage extraction can never break capture.
 */

/**
 * Path-like token matcher for command strings: a maximal run of path characters
 * that ends in `.md`. The negative class drops surrounding shell quotes,
 * pipes/redirects/separators, assignment (`=`), and list commas, so quoted and
 * comma-joined arguments split into clean candidates. `\b` after `.md` avoids
 * matching extensions like `.md5`. Order and duplicates are preserved.
 */
const COMMAND_MD_CANDIDATE = /[^\s'"`|&;<>(){}=,]+\.md\b/g;

/**
 * Collects markdown path candidates visibly named in a shell/search command
 * string, in command order with duplicates preserved. This is a conservative,
 * token-oriented scan — it never executes commands, expands globs, parses
 * stdout, or infers paths from prose. Downstream classification
 * (`src/lib/usage.ts`) decides which candidates are knowledge-base documents,
 * so it is safe (and intended) to return non-node candidates too. Non-string or
 * empty input yields no candidates and never throws.
 */
export function extractCommandMarkdownCandidates(command: unknown): string[] {
  if (typeof command !== 'string' || command.length === 0) return [];
  const out: string[] = [];
  COMMAND_MD_CANDIDATE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMMAND_MD_CANDIDATE.exec(command)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function readStringField(input: unknown, key: string): string | null {
  if (!input || typeof input !== 'object') return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function firstStringField(input: unknown, keys: string[]): string | null {
  for (const key of keys) {
    const value = readStringField(input, key);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Coerces a command-argument value into a single command string. Shell tools
 * carry the command either as a string (`"cat x"`) or as an argv array
 * (`["bash","-lc","cat x"]`, common in Codex); the array form is joined with
 * spaces so the candidate scanner sees the whole command. Anything else
 * (numbers, objects, empty) yields `null`.
 */
function commandText(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (Array.isArray(value)) {
    const parts = value.filter((v): v is string => typeof v === 'string');
    if (parts.length > 0) return parts.join(' ');
  }
  return null;
}

/** First non-empty command string found across `keys`, coerced via `commandText`. */
function firstCommandField(input: unknown, keys: readonly string[]): string | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const cmd = commandText(record[key]);
    if (cmd !== null) return cmd;
  }
  return null;
}

interface ContentBlock {
  type?: string;
  name?: string;
  input?: unknown;
}

interface ContentMessage {
  content?: unknown;
  message?: { content?: unknown };
}

/**
 * Config for the Anthropic-style `tool_use` content-block walker (Claude and
 * Cursor share the shape). For each block, in transcript order:
 *
 * - a `readTools` block contributes the value at `readPathKey` (a dedicated
 *   file read — pushed unconditionally; the usage layer filters it);
 * - otherwise, when `commandKeys` is set and the block is in `commandTools`
 *   (or `commandTools` is undefined, meaning "any non-read block"), the command
 *   string is scanned for markdown path candidates;
 * - otherwise, when `searchPathKeys` is set, an explicit path argument is
 *   counted only when it names a `.md` file (path-bearing search blocks).
 */
interface ContentBlockReadConfig {
  readTools: ReadonlySet<string>;
  readPathKey: string;
  commandTools?: ReadonlySet<string>;
  commandKeys?: readonly string[];
  searchPathKeys?: readonly string[];
}

function extractContentBlockReads(text: string, config: ContentBlockReadConfig): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let msg: ContentMessage;
    try {
      msg = JSON.parse(line) as ContentMessage;
    } catch {
      continue;
    }
    const content = msg.message?.content ?? msg.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as ContentBlock[]) {
      if (!block || typeof block !== 'object') continue;
      if (block.type !== 'tool_use' || typeof block.name !== 'string') continue;
      const name = block.name;
      if (config.readTools.has(name)) {
        const path = readStringField(block.input, config.readPathKey);
        if (path !== null) out.push(path);
        continue;
      }
      if (config.commandKeys && (!config.commandTools || config.commandTools.has(name))) {
        const command = firstCommandField(block.input, config.commandKeys);
        if (command !== null) {
          out.push(...extractCommandMarkdownCandidates(command));
          continue;
        }
      }
      if (config.searchPathKeys) {
        const path = firstStringField(block.input, [...config.searchPathKeys]);
        if (path !== null && path.endsWith('.md')) out.push(path);
      }
    }
  }
  return out;
}

/** Claude Code read tool name(s). Claude's reader is `Read`, path at `input.file_path`. */
const CLAUDE_READ_TOOLS = new Set(['Read']);

/** Claude Code shell tool name(s). Claude runs commands via `Bash`, command at `input.command`. */
const CLAUDE_COMMAND_TOOLS = new Set(['Bash']);

/**
 * Claude Code: `tool_use` blocks named `Read` (path at `input.file_path`) plus
 * markdown path candidates named in `Bash` commands (`input.command`).
 */
export function extractClaudeReads(text: string): string[] {
  return extractContentBlockReads(text, {
    readTools: CLAUDE_READ_TOOLS,
    readPathKey: 'file_path',
    commandTools: CLAUDE_COMMAND_TOOLS,
    commandKeys: ['command'],
  });
}

/**
 * Cursor read tool name(s). cursor-agent emits `Read` (current, e.g. CLI
 * 2026.06.x) and `ReadFile` (older builds); both carry the path at `input.path`
 * (measured against real on-disk agent transcripts). Matching only `ReadFile`
 * silently dropped every read on builds that use `Read`.
 */
const CURSOR_READ_TOOLS = new Set(['Read', 'ReadFile']);

/**
 * Cursor: `message.content[]` `tool_use` blocks named `Read`/`ReadFile` (path at
 * `input.path`), plus markdown candidates from command-bearing shell/search
 * blocks. Cursor's shell/search tool names vary by build, so command scanning
 * is shape-driven rather than name-pinned: any non-read block carrying a
 * `command`/`cmd` string is scanned, and a path-bearing search block counts only
 * when its `path`/`file_path` argument names a `.md` file (directory searches
 * are ignored).
 */
export function extractCursorReads(text: string): string[] {
  return extractContentBlockReads(text, {
    readTools: CURSOR_READ_TOOLS,
    readPathKey: 'path',
    commandKeys: ['command', 'cmd'],
    searchPathKeys: ['path', 'file_path'],
  });
}

interface RolloutLine {
  payload?: { type?: string; name?: string; arguments?: unknown };
}

/**
 * Codex read tool names. Codex has dedicated readers on some builds; this set
 * covers them when present. Codex also frequently reads via shell (`cat`,
 * `sed`, …) — those are now captured separately as command candidates.
 */
const CODEX_READ_TOOLS = new Set(['read', 'read_file', 'view', 'open_file']);

/**
 * Codex shell tool names. Codex runs commands through a shell-style function
 * call; the command lives in parsed `arguments` (string or argv array). Names
 * vary by build, so the set is conservative but covers the observed shapes.
 */
const CODEX_COMMAND_TOOLS = new Set(['shell', 'exec_command', 'local_shell', 'container.exec']);

/**
 * Codex: rollout `function_call`/`tool_call` items. Dedicated reader tools
 * contribute their `path` argument; shell tools contribute markdown path
 * candidates named in their command argument. Entries are emitted in rollout
 * order, preserving duplicates.
 */
export function extractCodexReads(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed: RolloutLine;
    try {
      parsed = JSON.parse(line) as RolloutLine;
    } catch {
      continue;
    }
    const payload = parsed.payload;
    if (!payload) continue;
    if (payload.type !== 'function_call' && payload.type !== 'tool_call') continue;
    if (typeof payload.name !== 'string') continue;
    if (CODEX_READ_TOOLS.has(payload.name)) {
      const args = parseArgs(payload.arguments);
      const path = firstStringField(args, ['path', 'file_path', 'filePath']);
      if (path !== null) out.push(path);
    } else if (CODEX_COMMAND_TOOLS.has(payload.name)) {
      const args = parseArgs(payload.arguments);
      const command = firstCommandField(args, ['command', 'cmd']);
      if (command !== null) out.push(...extractCommandMarkdownCandidates(command));
    }
  }
  return out;
}

function parseArgs(arg: unknown): unknown {
  if (arg && typeof arg === 'object') return arg;
  if (typeof arg === 'string') {
    try {
      return JSON.parse(arg) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

interface CopilotToolEvent {
  type?: string;
  data?: { toolName?: string; arguments?: unknown };
}

/** Copilot read tool name(s). Measured `view` on CLI v1.0.61; may vary by build. */
const COPILOT_READ_TOOLS = new Set(['view']);

/**
 * Copilot shell tool name(s). Copilot runs commands via a shell tool with the
 * command at `data.arguments.command`. Names vary by build, so the set is
 * conservative but covers the observed shapes.
 */
const COPILOT_COMMAND_TOOLS = new Set(['bash', 'shell', 'run_in_terminal', 'exec']);

/**
 * Copilot: `events.jsonl` `tool.execution_start` events. A read tool
 * (`data.toolName` in `COPILOT_READ_TOOLS`) contributes `data.arguments.path`;
 * a shell tool contributes markdown path candidates from
 * `data.arguments.command`. Emitted in event order, preserving duplicates.
 */
export function extractCopilotReads(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let event: CopilotToolEvent;
    try {
      event = JSON.parse(line) as CopilotToolEvent;
    } catch {
      continue;
    }
    if (event.type !== 'tool.execution_start') continue;
    const name = event.data?.toolName;
    if (typeof name !== 'string') continue;
    if (COPILOT_READ_TOOLS.has(name)) {
      const path = readStringField(event.data?.arguments, 'path');
      if (path !== null) out.push(path);
    } else if (COPILOT_COMMAND_TOOLS.has(name)) {
      const command = firstCommandField(event.data?.arguments, ['command', 'cmd']);
      if (command !== null) out.push(...extractCommandMarkdownCandidates(command));
    }
  }
  return out;
}

interface OpenCodePart {
  type?: string;
  tool?: string;
  state?: { input?: unknown };
}

/** OpenCode read tool name(s). OpenCode's built-in reader is `read`. */
const OPENCODE_READ_TOOLS = new Set(['read']);

/** OpenCode shell tool name(s). OpenCode runs commands via `bash`; command at `state.input.command`. */
const OPENCODE_COMMAND_TOOLS = new Set(['bash', 'shell']);

/**
 * Candidates from a single OpenCode export part: a `read` tool part contributes
 * its `state.input` file path; a shell tool part contributes markdown path
 * candidates named in its `state.input.command`. Non-tool/unknown parts yield
 * nothing.
 */
function openCodePartCandidates(part: OpenCodePart): string[] {
  if (part.type !== 'tool' || typeof part.tool !== 'string') return [];
  if (OPENCODE_READ_TOOLS.has(part.tool)) {
    const path = firstStringField(part.state?.input, ['filePath', 'path', 'file_path']);
    return path !== null ? [path] : [];
  }
  if (OPENCODE_COMMAND_TOOLS.has(part.tool)) {
    const command = firstCommandField(part.state?.input, ['command', 'cmd']);
    return command !== null ? extractCommandMarkdownCandidates(command) : [];
  }
  return [];
}

interface OpenCodeMessage {
  parts?: unknown;
}

interface OpenCodeExport {
  messages?: unknown;
}

/**
 * OpenCode: walks the parsed `opencode export <id>` document
 * (`{ messages: [{ parts: [...] }] }`, verified against OpenCode v1.17.3) and
 * returns, in document order with duplicates preserved, the file path of every
 * `read` tool part plus markdown path candidates named in `bash`/`shell` tool
 * command parts. Read paths come from `state.input`
 * (`filePath`/`path`/`file_path`); command text from `state.input.command`. Any
 * unrecognized or malformed shape yields no entries.
 */
export function extractOpenCodeReads(exportJson: unknown): string[] {
  const out: string[] = [];
  if (!exportJson || typeof exportJson !== 'object') return out;
  const messages = (exportJson as OpenCodeExport).messages;
  if (!Array.isArray(messages)) return out;
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const parts = (message as OpenCodeMessage).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      out.push(...openCodePartCandidates(part as OpenCodePart));
    }
  }
  return out;
}

/**
 * Kiro: walks the parsed Kiro session JSON (`~/.kiro/sessions/cli/<uuid>.json`)
 * and returns, in document order with duplicates preserved, markdown path
 * candidates from the assistant response text in each turn.
 *
 * Kiro's session format stores assistant responses in
 * `session_state.conversation_metadata.user_turn_metadatas[n].result.Ok.content[].data`.
 * User turn text is not stored. The read-extract scans assistant text for
 * markdown path candidates (shell command patterns via
 * `extractCommandMarkdownCandidates`).
 *
 * Note: dedicated file-read tool calls are not separately surfaced in Kiro's
 * session JSON; this extractor operates on the visible assistant text only.
 * Best-effort and non-fatal — any malformed shape yields no entries.
 */
export function extractKiroReads(sessionJson: unknown): string[] {
  const out: string[] = [];
  if (!sessionJson || typeof sessionJson !== 'object') return out;
  const turns = (
    (sessionJson as Record<string, unknown>)?.['session_state'] as Record<string, unknown>
  )?.['conversation_metadata'] as Record<string, unknown>;
  const metadatas = turns?.['user_turn_metadatas'];
  if (!Array.isArray(metadatas)) return out;
  for (const turn of metadatas) {
    const ok = (turn as Record<string, unknown>)?.['result'] !== undefined
      ? ((turn as Record<string, unknown>)['result'] as Record<string, unknown>)?.['Ok']
      : undefined;
    if (!ok) continue;
    const content = (ok as Record<string, unknown>)?.['content'];
    if (!Array.isArray(content)) continue;
    for (const c of content as Array<Record<string, unknown>>) {
      if (c?.['kind'] !== 'text') continue;
      const text = String(c['data'] ?? '');
      if (text.length > 0) out.push(...extractCommandMarkdownCandidates(text));
    }
  }
  return out;
}
