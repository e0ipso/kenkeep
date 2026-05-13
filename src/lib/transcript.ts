/**
 * Parses a Claude Code session JSONL transcript into role-tagged user and
 * agent turns. Each line in the transcript is a JSON message; we keep only
 * user and assistant messages and extract their textual content.
 */

export interface RoleTaggedTranscript {
  interleaved: Array<{ role: 'user' | 'agent'; text: string }>;
}

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
 */
export function renderRoleTagged(t: RoleTaggedTranscript): string {
  return t.interleaved
    .map(seg => `[${seg.role === 'user' ? 'USER' : 'AGENT'}]: ${seg.text}`)
    .join('\n\n');
}
