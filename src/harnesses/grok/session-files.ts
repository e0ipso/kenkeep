import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, sep } from 'node:path';

export function grokHome(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['GROK_HOME'];
  if (explicit && explicit.length > 0) return explicit;
  return join(homedir(), '.grok');
}

export function encodeSessionCwd(cwd: string): string {
  return encodeURIComponent(cwd);
}

function isInside(root: string, candidate: string): boolean {
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate === root || candidate.startsWith(prefix);
}

function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function summaryCwdMatches(sessionDir: string, expectedCwd: string): boolean {
  const summaryFile = join(sessionDir, 'summary.json');
  if (!existsSync(summaryFile)) return true;
  try {
    const parsed = JSON.parse(readFileSync(summaryFile, 'utf8')) as {
      info?: { cwd?: string };
    };
    const recorded = parsed.info?.cwd;
    if (typeof recorded !== 'string' || recorded.length === 0) return true;
    const recordedReal = realpathOrNull(recorded);
    const expectedReal = realpathOrNull(expectedCwd);
    if (recordedReal === null || expectedReal === null) {
      return recorded === expectedCwd;
    }
    return recordedReal === expectedReal;
  } catch {
    return true;
  }
}

/**
 * Resolves `chat_history.jsonl` for a Grok session. The path is confined to
 * `$GROK_HOME/sessions` (realpath) so a crafted session id or cwd cannot
 * walk into another project. Returns null when the file is missing or
 * the recorded session cwd does not match `cwd`.
 */
export function locateGrokChatHistory(opts: {
  sessionId: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const env = opts.env ?? process.env;
  const home = grokHome(env);
  const sessionsRoot = realpathOrNull(join(home, 'sessions'));
  if (sessionsRoot === null) return null;

  const encoded = encodeSessionCwd(opts.cwd);
  const direct = join(sessionsRoot, encoded, opts.sessionId, 'chat_history.jsonl');
  const resolved = resolveIfConfined(sessionsRoot, direct, opts.cwd);
  if (resolved !== null) return resolved;

  return findByScan(sessionsRoot, opts.sessionId, opts.cwd);
}

function resolveIfConfined(sessionsRoot: string, candidate: string, cwd: string): string | null {
  if (!existsSync(candidate)) return null;
  const real = realpathOrNull(candidate);
  if (real === null || !isInside(sessionsRoot, real)) return null;
  const sessionDir = dirname(real);
  if (!summaryCwdMatches(sessionDir, cwd)) return null;
  return real;
}

function findByScan(sessionsRoot: string, sessionId: string, cwd: string): string | null {
  let groups: string[];
  try {
    groups = readdirSync(sessionsRoot);
  } catch {
    return null;
  }
  for (const group of groups) {
    if (group.startsWith('.')) continue;
    const candidate = join(sessionsRoot, group, sessionId, 'chat_history.jsonl');
    const resolved = resolveIfConfined(sessionsRoot, candidate, cwd);
    if (resolved !== null) return resolved;
  }
  return null;
}
