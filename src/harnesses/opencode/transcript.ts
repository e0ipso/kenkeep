import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { RoleTaggedTranscript } from '../types.js';
import { renderRoleTagged } from '../../lib/transcript-render.js';

interface SessionFile {
  id?: string;
  projectID?: string;
  time?: { created?: number; updated?: number };
  title?: string;
}

interface MessageFile {
  id?: string;
  role?: 'user' | 'assistant' | string;
  time?: { created?: number };
}

interface PartFile {
  id?: string;
  type?: string;
  text?: string;
}

/**
 * Resolves the on-disk OpenCode storage directory. Honors
 * `OPENCODE_STORAGE_DIR` (a project-local override used by tests), then
 * the documented `${XDG_DATA_HOME}/opencode/storage/` location, then the
 * `${HOME}/.local/share/opencode/storage/` default.
 */
export function defaultOpenCodeStorageDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['OPENCODE_STORAGE_DIR'];
  if (explicit && explicit.length > 0) return explicit;
  const xdg = env['XDG_DATA_HOME'];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.local', 'share');
  return join(base, 'opencode', 'storage');
}

/**
 * Parses an OpenCode on-disk session into the canonical role-tagged
 * transcript shape.
 *
 * Layout (per OpenCode docs):
 *
 *     storageDir/
 *       session/<projectID>/<sessionID>.json
 *       message/<sessionID>/<messageID>.json
 *       part/<messageID>/<partID>.json
 *
 * Messages are sorted by `time.created` (numeric epoch ms); parts are
 * also sorted by `time.created` if present, otherwise by filename.
 *
 * Only `type === 'text'` parts contribute to the transcript. Tool-call
 * parts are ignored. When the session file is missing or the message
 * tree yields zero text turns, the caller (kb-capture) is expected to
 * fall back to `opencode export`.
 */
export function parseOpenCodeTranscript(
  storageDir: string,
  sessionID: string
): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  const sessionRoot = join(storageDir, 'session');
  const messageRoot = join(storageDir, 'message', sessionID);
  if (!existsSync(messageRoot)) return out;

  // Locate the session.json by walking the project subdirectories. The
  // file path is `session/<projectID>/<sessionID>.json`; we do not know
  // projectID in advance and OpenCode does not stamp it on the message
  // files.
  let sessionFile: SessionFile | null = null;
  if (existsSync(sessionRoot)) {
    for (const project of readdirSync(sessionRoot)) {
      const candidate = join(sessionRoot, project, `${sessionID}.json`);
      if (existsSync(candidate)) {
        try {
          sessionFile = JSON.parse(readFileSync(candidate, 'utf8')) as SessionFile;
        } catch {
          sessionFile = null;
        }
        break;
      }
    }
  }
  // The session file presence is informational; the message tree drives
  // transcript construction. A missing session file with a present
  // message tree still yields a valid transcript.
  void sessionFile;

  const messageFiles = readdirSync(messageRoot)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const full = join(messageRoot, name);
      let content: MessageFile;
      try {
        content = JSON.parse(readFileSync(full, 'utf8')) as MessageFile;
      } catch {
        content = {};
      }
      return { name, content };
    })
    .sort((a, b) => (a.content.time?.created ?? 0) - (b.content.time?.created ?? 0));

  const partRoot = join(storageDir, 'part');
  for (const { content: message } of messageFiles) {
    if (!message.id || (message.role !== 'user' && message.role !== 'assistant')) continue;
    const partDir = join(partRoot, message.id);
    if (!existsSync(partDir)) continue;
    const parts = readdirSync(partDir)
      .filter(name => name.endsWith('.json'))
      .map(name => {
        const full = join(partDir, name);
        let content: PartFile;
        try {
          content = JSON.parse(readFileSync(full, 'utf8')) as PartFile;
        } catch {
          content = {};
        }
        return { name, content };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const text = parts
      .filter(p => p.content.type === 'text' && typeof p.content.text === 'string')
      .map(p => p.content.text as string)
      .filter(s => s.length > 0)
      .join('\n');
    if (!text) continue;
    out.interleaved.push({
      role: message.role === 'user' ? 'user' : 'agent',
      text,
    });
  }

  return out;
}

/**
 * Placeholder text-mode parser kept for the `HarnessAdapter` contract;
 * callers that have a session id should use `parseOpenCodeTranscript`
 * directly with a storage dir argument.
 */
export function parseOpenCodeTranscriptText(_text: string): RoleTaggedTranscript {
  return { interleaved: [] };
}

export function renderOpenCodeTranscript(t: RoleTaggedTranscript): string {
  return renderRoleTagged(t);
}
