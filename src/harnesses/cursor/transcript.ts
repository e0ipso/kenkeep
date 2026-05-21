/**
 * Parses Cursor agent transcript JSONL into the canonical role-tagged
 * transcript structure shared across harnesses. Cursor emits lines with
 * `role: user|assistant` and text in `message.content[]`.
 */
import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

interface CursorTranscriptLine {
  role?: string;
  type?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

function extractText(line: CursorTranscriptLine): string {
  const blocks = line.message?.content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter(b => !!b && typeof b === 'object')
    .map(b => (typeof b.text === 'string' ? b.text : ''))
    .filter(s => s.length > 0)
    .join('\n');
}

function lineRole(line: CursorTranscriptLine): 'user' | 'assistant' | null {
  const role = line.role ?? line.message?.role;
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'assistant';
  if (line.type === 'user') return 'user';
  if (line.type === 'assistant') return 'assistant';
  return null;
}

export function parseCursorTranscript(text: string): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed: CursorTranscriptLine;
    try {
      parsed = JSON.parse(line) as CursorTranscriptLine;
    } catch (err) {
      console.warn(
        `parseCursorTranscript: skipping malformed JSONL line: ${(err as Error).message}`
      );
      continue;
    }
    const role = lineRole(parsed);
    const turnText = extractText(parsed);
    if (!role || !turnText) continue;
    if (role === 'user') {
      out.interleaved.push({ role: 'user', text: turnText });
    } else {
      out.interleaved.push({ role: 'agent', text: turnText });
    }
  }
  return out;
}

export function renderCursorTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
