/**
 * Per-harness extractors that surface the file paths an agent opened via read
 * tool calls in a harness's raw transcript. These feed knowledge-base usage
 * tracking (`src/lib/usage.ts` decides which paths are knowledge-base
 * documents). Each extractor returns the read paths in order and preserves
 * duplicates, so repeated reads of the same file are counted repeatedly. Only
 * explicit file-open read tools count; search/shell tools are ignored. Every
 * extractor is defensive: malformed lines and unrecognized shapes yield no
 * entries rather than throwing, so usage extraction can never break capture.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
 * shape) for a given read tool name, returning the value at `pathKey` of each
 * matching block's `input`.
 */
function extractContentBlockReads(text: string, toolName: string, pathKey: string): string[] {
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
      if (block.type === 'tool_use' && block.name === toolName) {
        const path = readStringField(block.input, pathKey);
        if (path !== null) out.push(path);
      }
    }
  }
  return out;
}

/** Claude Code: `tool_use` blocks named `Read`, path at `input.file_path`. */
export function extractClaudeReads(text: string): string[] {
  return extractContentBlockReads(text, 'Read', 'file_path');
}

/**
 * Cursor: `message.content[]` `tool_use` blocks named `ReadFile`, path at
 * `input.path` (verified against a real on-disk agent transcript).
 */
export function extractCursorReads(text: string): string[] {
  return extractContentBlockReads(text, 'ReadFile', 'path');
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

/**
 * OpenCode: walks the on-disk `part/<messageID>/` tree for read tool parts. The
 * exact tool-part shape is based on OpenCode's documented storage model and is
 * unverified against a real session, so it degrades to no entries on an
 * unrecognized shape. The `opencode export` fallback path does not record usage.
 */
export function extractOpenCodeReads(storageDir: string, sessionId: string): string[] {
  const out: string[] = [];
  const messageRoot = join(storageDir, 'message', sessionId);
  if (!existsSync(messageRoot)) return out;
  const partRoot = join(storageDir, 'part');
  let messageFiles: string[];
  try {
    messageFiles = readdirSync(messageRoot).filter(name => name.endsWith('.json'));
  } catch {
    return out;
  }
  for (const name of messageFiles) {
    let message: { id?: string };
    try {
      message = JSON.parse(readFileSync(join(messageRoot, name), 'utf8')) as { id?: string };
    } catch {
      continue;
    }
    if (!message.id) continue;
    const partDir = join(partRoot, message.id);
    if (!existsSync(partDir)) continue;
    let partFiles: string[];
    try {
      partFiles = readdirSync(partDir)
        .filter(p => p.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      continue;
    }
    for (const partFile of partFiles) {
      let part: OpenCodePart;
      try {
        part = JSON.parse(readFileSync(join(partDir, partFile), 'utf8')) as OpenCodePart;
      } catch {
        continue;
      }
      const path = openCodePartReadPath(part);
      if (path !== null) out.push(path);
    }
  }
  return out;
}
