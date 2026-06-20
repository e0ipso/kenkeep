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
 * Walks Anthropic-style `tool_use` content blocks (Claude and Cursor share this
 * shape) for a set of read tool names, returning the value at `pathKey` of each
 * matching block's `input`.
 */
function extractContentBlockReads(
  text: string,
  toolNames: ReadonlySet<string>,
  pathKey: string
): string[] {
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
      if (
        block.type === 'tool_use' &&
        typeof block.name === 'string' &&
        toolNames.has(block.name)
      ) {
        const path = readStringField(block.input, pathKey);
        if (path !== null) out.push(path);
      }
    }
  }
  return out;
}

/** Claude Code read tool name(s). Claude's reader is `Read`, path at `input.file_path`. */
const CLAUDE_READ_TOOLS = new Set(['Read']);

/** Claude Code: `tool_use` blocks named `Read`, path at `input.file_path`. */
export function extractClaudeReads(text: string): string[] {
  return extractContentBlockReads(text, CLAUDE_READ_TOOLS, 'file_path');
}

/**
 * Cursor read tool name(s). cursor-agent emits `Read` (current, e.g. CLI
 * 2026.06.x) and `ReadFile` (older builds); both carry the path at `input.path`
 * (measured against real on-disk agent transcripts). Matching only `ReadFile`
 * silently dropped every read on builds that use `Read`.
 */
const CURSOR_READ_TOOLS = new Set(['Read', 'ReadFile']);

/** Cursor: `message.content[]` `tool_use` blocks named `Read`/`ReadFile`, path at `input.path`. */
export function extractCursorReads(text: string): string[] {
  return extractContentBlockReads(text, CURSOR_READ_TOOLS, 'path');
}

interface RolloutLine {
  payload?: { type?: string; name?: string; arguments?: unknown };
}

/**
 * Codex read tool names. Codex frequently reads via the `shell` tool (out of
 * scope), so this set covers the dedicated read tools when present. The exact
 * name/argument key is unverified against a real rollout, so the matcher is
 * defensive and yields nothing when Codex reads only via shell.
 */
const CODEX_READ_TOOLS = new Set(['read', 'read_file', 'view', 'open_file']);

/** Codex: rollout `function_call` items whose tool name is a dedicated reader. */
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
    if (
      (payload.type === 'function_call' || payload.type === 'tool_call') &&
      typeof payload.name === 'string' &&
      CODEX_READ_TOOLS.has(payload.name)
    ) {
      const args = parseArgs(payload.arguments);
      const path = firstStringField(args, ['path', 'file_path', 'filePath']);
      if (path !== null) out.push(path);
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
 * Copilot: `events.jsonl` `tool.execution_start` events whose `data.toolName`
 * is a read tool, path at `data.arguments.path` (measured on CLI v1.0.61).
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
    if (typeof name !== 'string' || !COPILOT_READ_TOOLS.has(name)) continue;
    const path = readStringField(event.data?.arguments, 'path');
    if (path !== null) out.push(path);
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

function openCodePartReadPath(part: OpenCodePart): string | null {
  if (part.type !== 'tool' || typeof part.tool !== 'string') return null;
  if (!OPENCODE_READ_TOOLS.has(part.tool)) return null;
  return firstStringField(part.state?.input, ['filePath', 'path', 'file_path']);
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
 * returns the file path of every `read` tool part in document order, preserving
 * duplicates. Only parts where `type === 'tool' && tool === 'read'` count; the
 * read path is taken from `state.input` (`filePath`/`path`/`file_path`). Any
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
      const path = openCodePartReadPath(part as OpenCodePart);
      if (path !== null) out.push(path);
    }
  }
  return out;
}
