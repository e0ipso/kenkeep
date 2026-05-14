/**
 * Parses a Claude Code session JSONL transcript into role-tagged user and
 * agent turns. Each line in the transcript is a JSON message; we keep only
 * user and assistant messages and extract their textual content.
 */
import type { RoleTaggedTranscript } from '../types.js';

interface RawContentBlock {
  type?: string;
  text?: string;
}

interface RawMessage {
  type?: string;
  message?: {
    role?: string;
    content?: string | RawContentBlock[];
  };
  // Some transcript shapes inline content at the top level.
  role?: string;
  content?: string | RawContentBlock[];
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is RawContentBlock => !!c && typeof c === 'object')
      .filter(c => (c.type ?? 'text') === 'text')
      .map(c => (typeof c.text === 'string' ? c.text : ''))
      .filter(s => s.length > 0)
      .join('\n');
  }
  return '';
}

export function parseTranscriptJsonl(text: string): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    let msg: RawMessage;
    try {
      msg = JSON.parse(line) as RawMessage;
    } catch {
      continue;
    }
    const role = msg.message?.role ?? msg.role ?? msg.type;
    const content = msg.message?.content ?? msg.content;
    if (role === 'user') {
      const text = extractText(content);
      if (text) {
        out.interleaved.push({ role: 'user', text });
      }
    } else if (role === 'assistant' || role === 'agent') {
      const text = extractText(content);
      if (text) {
        out.interleaved.push({ role: 'agent', text });
      }
    }
  }
  return out;
}

/**
 * Renders the role-tagged transcript in the `[USER]: ...` / `[AGENT]: ...`
 * format consumed by the proposal extraction prompt and stored in the
 * session log under the "Transcript" section.
 *
 * A user segment whose body is exactly `/self-review-apply <path>.xml` is
 * tagged `[USER /self-review-apply <path>]:` and the immediately following
 * agent segment, if any, is tagged `[AGENT NARRATION OF SELF-REVIEW <path>]:`.
 * This lets the proposal-extract prompt key off a fixed marker instead of
 * re-deriving the slash-command via regex over a variable filename.
 */
const SELF_REVIEW_APPLY_TRIGGER = /^\s*\/self-review-apply\s+(\S+\.xml)\s*$/;

export function renderRoleTagged(t: RoleTaggedTranscript): string {
  const segs = t.interleaved;
  const lines: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    if (seg.role === 'user') {
      const match = SELF_REVIEW_APPLY_TRIGGER.exec(seg.text);
      if (match) {
        const path = match[1];
        lines.push(`[USER /self-review-apply ${path}]: ${seg.text}`);
        const next = segs[i + 1];
        if (next && next.role === 'agent') {
          lines.push(`[AGENT NARRATION OF SELF-REVIEW ${path}]: ${next.text}`);
          i += 1;
        }
        continue;
      }
      lines.push(`[USER]: ${seg.text}`);
    } else {
      lines.push(`[AGENT]: ${seg.text}`);
    }
  }
  return lines.join('\n\n');
}
