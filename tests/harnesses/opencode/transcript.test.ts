import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { parseOpenCodeTranscript } from '../../../src/harnesses/opencode/transcript.js';

interface Cleanup {
  paths: string[];
}

const cleanup: Cleanup = { paths: [] };
afterEach(() => {
  for (const p of cleanup.paths) rmSync(p, { recursive: true, force: true });
  cleanup.paths = [];
});

function makeStorage(): string {
  const root = mkdtempSync(join(tmpdir(), 'kb-opencode-storage-'));
  cleanup.paths.push(root);
  return root;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

describe('parseOpenCodeTranscript', () => {
  it('parses a two-turn user/assistant exchange ordered by time.created', () => {
    const storage = makeStorage();
    const sessionId = 'sess-123';
    const projectId = 'proj-abc';

    mkdirSync(join(storage, 'session', projectId), { recursive: true });
    writeJson(join(storage, 'session', projectId, `${sessionId}.json`), {
      id: sessionId,
      projectID: projectId,
      time: { created: 100, updated: 200 },
    });

    const messageDir = join(storage, 'message', sessionId);
    mkdirSync(messageDir, { recursive: true });
    writeJson(join(messageDir, 'm1.json'), {
      id: 'm1',
      role: 'user',
      time: { created: 110 },
    });
    writeJson(join(messageDir, 'm2.json'), {
      id: 'm2',
      role: 'assistant',
      time: { created: 120 },
    });

    mkdirSync(join(storage, 'part', 'm1'), { recursive: true });
    writeJson(join(storage, 'part', 'm1', 'p1.json'), {
      id: 'p1',
      type: 'text',
      text: 'hello opencode',
    });
    mkdirSync(join(storage, 'part', 'm2'), { recursive: true });
    writeJson(join(storage, 'part', 'm2', 'p1.json'), {
      id: 'p1',
      type: 'text',
      text: 'hi there',
    });

    const transcript = parseOpenCodeTranscript(storage, sessionId);
    expect(transcript.interleaved).toEqual([
      { role: 'user', text: 'hello opencode' },
      { role: 'agent', text: 'hi there' },
    ]);
  });

  it('returns empty interleaved when message dir is missing', () => {
    const storage = makeStorage();
    const transcript = parseOpenCodeTranscript(storage, 'nonexistent');
    expect(transcript.interleaved).toEqual([]);
  });

  it('skips messages whose only parts are non-text (tool calls)', () => {
    const storage = makeStorage();
    const sessionId = 'tool-only';
    const messageDir = join(storage, 'message', sessionId);
    mkdirSync(messageDir, { recursive: true });
    writeJson(join(messageDir, 'm1.json'), {
      id: 'm1',
      role: 'assistant',
      time: { created: 1 },
    });
    mkdirSync(join(storage, 'part', 'm1'), { recursive: true });
    writeJson(join(storage, 'part', 'm1', 'p1.json'), {
      id: 'p1',
      type: 'tool-call',
      text: 'should not appear',
    });

    const transcript = parseOpenCodeTranscript(storage, sessionId);
    expect(transcript.interleaved).toEqual([]);
  });

  it('orders messages by time.created across out-of-order files', () => {
    const storage = makeStorage();
    const sessionId = 'ordered';
    const messageDir = join(storage, 'message', sessionId);
    mkdirSync(messageDir, { recursive: true });
    writeJson(join(messageDir, 'z.json'), {
      id: 'a',
      role: 'user',
      time: { created: 1 },
    });
    writeJson(join(messageDir, 'a.json'), {
      id: 'b',
      role: 'assistant',
      time: { created: 2 },
    });
    mkdirSync(join(storage, 'part', 'a'), { recursive: true });
    writeJson(join(storage, 'part', 'a', 'p.json'), { id: 'p', type: 'text', text: 'first' });
    mkdirSync(join(storage, 'part', 'b'), { recursive: true });
    writeJson(join(storage, 'part', 'b', 'p.json'), { id: 'p', type: 'text', text: 'second' });

    const transcript = parseOpenCodeTranscript(storage, sessionId);
    expect(transcript.interleaved).toEqual([
      { role: 'user', text: 'first' },
      { role: 'agent', text: 'second' },
    ]);
  });
});
