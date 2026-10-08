import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENTS_BLOCK_END,
  AGENTS_BLOCK_START,
  ensureAgentsKkBlock,
} from '../../src/lib/agents-block.js';
import {
  OPENCODE_GITIGNORE_END,
  OPENCODE_GITIGNORE_START,
  ensureOpenCodeGitignore,
} from '../../src/harnesses/opencode/install.js';
import {
  SENTINEL_END,
  SENTINEL_START,
  writeCopilotInstructionsSentinel,
} from '../../src/harnesses/copilot/hooks-config.js';

/**
 * Every kenkeep writer that maintains a sentinel-delimited block inside a
 * user-owned file shares one malformed-sentinel policy: an orphaned
 * start, an orphaned end, duplicated pairs or reversed markers never extend
 * the managed region over user text. The writer refuses with a diagnostic
 * naming the file and leaves the bytes untouched.
 */
interface Writer {
  name: string;
  start: string;
  end: string;
  /** Relative path of the managed file under the fixture root. */
  rel: string;
  write(root: string): Promise<void>;
}

const writers: Writer[] = [
  {
    name: 'AGENTS.md pointer block',
    start: AGENTS_BLOCK_START,
    end: AGENTS_BLOCK_END,
    rel: 'AGENTS.md',
    write: async root => {
      ensureAgentsKkBlock(join(root, 'AGENTS.md'));
    },
  },
  {
    name: 'OpenCode .gitignore block',
    start: OPENCODE_GITIGNORE_START,
    end: OPENCODE_GITIGNORE_END,
    rel: '.opencode/.gitignore',
    write: async root => {
      ensureOpenCodeGitignore(join(root, '.opencode', '.gitignore'));
    },
  },
  {
    name: 'Copilot instructions sentinel',
    start: SENTINEL_START,
    end: SENTINEL_END,
    rel: '.github/copilot-instructions.md',
    write: async root => {
      await writeCopilotInstructionsSentinel({
        dir: join(root, '.github'),
        hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'copilot'),
        skillsDir: join(root, '.github', 'skills'),
      });
    },
  },
];

const HEAD = 'user head line one\nuser head line two\n';
const MIDDLE = 'user notes that sit between markers\n';
const TAIL = 'user tail that must survive\nlast user line\n';

describe.each(writers)('$name: malformed sentinels never erase user text', w => {
  let root: string;
  let file: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-managed-block-'));
    file = join(root, w.rel);
    mkdirSync(join(file, '..'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const malformed: Array<[string, (w: Writer) => string]> = [
    ['orphaned start marker', w => `${HEAD}${w.start}\nstale managed line\n${TAIL}`],
    ['orphaned end marker', w => `${HEAD}stale managed line\n${w.end}\n${TAIL}`],
    [
      'duplicated marker pairs',
      w => `${HEAD}${w.start}\nold\n${w.end}\n${MIDDLE}${w.start}\nolder\n${w.end}\n${TAIL}`,
    ],
    ['end marker before start marker', w => `${HEAD}${w.end}\n${MIDDLE}${w.start}\n${TAIL}`],
  ];

  it.each(malformed)(
    '%s: refuses with a diagnostic naming the file, bytes unchanged',
    async (_label, build) => {
      const original = build(w);
      writeFileSync(file, original);
      await expect(w.write(root)).rejects.toThrow(file);
      await expect(w.write(root)).rejects.toThrow(/left .*unchanged/);
      expect(readFileSync(file, 'utf8')).toBe(original);
    }
  );

  it('replaces a well-formed block in place, keeping text before and after byte-identical', async () => {
    writeFileSync(file, `${HEAD}${w.start}\nstale managed line\n${w.end}\n${TAIL}`);
    await w.write(root);
    const next = readFileSync(file, 'utf8');
    expect(next).not.toContain('stale managed line');
    expect(next.split(w.start)).toHaveLength(2);
    expect(next.split(w.end)).toHaveLength(2);
    const before = next.slice(0, next.indexOf(w.start));
    const after = next.slice(next.indexOf(w.end) + w.end.length);
    expect(before.trimEnd()).toBe(HEAD.trimEnd());
    expect(after.trim()).toBe(TAIL.trim());
    // Idempotent: a second run is byte-stable.
    await w.write(root);
    expect(readFileSync(file, 'utf8')).toBe(next);
  });

  it('treats an inline mention of a marker in prose as user text, not a sentinel', async () => {
    const prose = `${HEAD}Docs: the block sits between \`${w.start}\` and \`${w.end}\` lines.\n${TAIL}`;
    writeFileSync(file, prose);
    await w.write(root);
    const next = readFileSync(file, 'utf8');
    expect(next.startsWith(prose.trimEnd())).toBe(true);
    expect(next.trimEnd().endsWith(w.end)).toBe(true);
    await w.write(root);
    expect(readFileSync(file, 'utf8')).toBe(next);
  });

  it('creates the file when absent', async () => {
    rmSync(file, { force: true });
    await w.write(root);
    expect(existsSync(file)).toBe(true);
    const body = readFileSync(file, 'utf8');
    expect(body.startsWith(w.start)).toBe(true);
  });
});
