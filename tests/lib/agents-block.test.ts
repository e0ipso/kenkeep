import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENTS_BLOCK_END,
  AGENTS_BLOCK_START,
  checkAgentsKkBlock,
  ensureAgentsKkBlock,
} from '../../src/lib/agents-block.js';

describe('ensureAgentsKkBlock', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-agents-block-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('creates the file with exactly one block and is idempotent', () => {
    const file = join(dir, 'AGENTS.md');
    expect(ensureAgentsKkBlock(file)).toBe(true);
    expect(ensureAgentsKkBlock(file)).toBe(false); // unchanged second run
    const body = readFileSync(file, 'utf8');
    expect(body.split(AGENTS_BLOCK_START)).toHaveLength(2);
    expect(body.split(AGENTS_BLOCK_END)).toHaveLength(2);
  });

  it('appends after user content and replaces a stale block in place', () => {
    const file = join(dir, 'AGENTS.md');
    writeFileSync(file, '# My project\n\nHand-written intro.\n');
    expect(ensureAgentsKkBlock(file)).toBe(true);
    let body = readFileSync(file, 'utf8');
    expect(body.startsWith('# My project')).toBe(true);
    expect(body).toContain(AGENTS_BLOCK_START);

    // Corrupt the block content; ensure restores it without touching the rest.
    body = body.replace('You are required to load', 'STALE WORDING');
    writeFileSync(file, body);
    expect(ensureAgentsKkBlock(file)).toBe(true);
    const restored = readFileSync(file, 'utf8');
    expect(restored).toContain('You are required to load');
    expect(restored).not.toContain('STALE WORDING');
    expect(restored.startsWith('# My project')).toBe(true);
  });
});

describe('checkAgentsKkBlock', () => {
  let root: string;
  let kkDir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-agents-check-'));
    kkDir = join(root, '.ai', 'kenkeep');
    mkdirSync(kkDir, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('flags a missing AGENTS.md, then a missing block, then nothing once seeded', () => {
    expect(checkAgentsKkBlock(root, kkDir, 0)).toHaveLength(1);

    writeFileSync(join(root, 'AGENTS.md'), '# Repo\n');
    const noBlock = checkAgentsKkBlock(root, kkDir, 0);
    expect(noBlock).toHaveLength(1);
    expect(noBlock[0]!.message).toContain('missing the kenkeep pointer block');

    ensureAgentsKkBlock(join(root, 'AGENTS.md'));
    expect(checkAgentsKkBlock(root, kkDir, 0)).toHaveLength(0);
  });

  it('flags a populated tree whose ENTRY.md target is missing, but not an empty one', () => {
    ensureAgentsKkBlock(join(root, 'AGENTS.md'));
    // Empty tree: no catalog yet is the normal fresh-init state.
    expect(checkAgentsKkBlock(root, kkDir, 0)).toHaveLength(0);
    // Populated tree without ENTRY.md: the pointer dangles.
    const populated = checkAgentsKkBlock(root, kkDir, 5);
    expect(populated).toHaveLength(1);
    expect(populated[0]!.file).toBe('.ai/kenkeep/ENTRY.md');

    writeFileSync(join(kkDir, 'ENTRY.md'), '# kenkeep\n');
    expect(checkAgentsKkBlock(root, kkDir, 5)).toHaveLength(0);
  });
});
