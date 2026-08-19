import { describe, expect, it } from 'vitest';
import {
  extractClaudeReads,
  extractCodexReads,
  extractCommandMarkdownCandidates,
  extractCopilotReads,
  extractCursorReads,
  extractKiroReads,
  extractOpenCodeReads,
} from '../../src/harnesses/read-extract.js';

describe('extractCommandMarkdownCandidates', () => {
  it('collects markdown path candidates in command order, preserving duplicates', () => {
    expect(
      extractCommandMarkdownCandidates(
        'cat .ai/kenkeep/nodes/a.md nodes/b.md .ai/kenkeep/nodes/a.md'
      )
    ).toEqual(['.ai/kenkeep/nodes/a.md', 'nodes/b.md', '.ai/kenkeep/nodes/a.md']);
  });

  it('strips surrounding quotes and trailing separators, and splits comma-joined args', () => {
    expect(
      extractCommandMarkdownCandidates(`sed -n '1,40p' "nodes/x.md"; head nodes/y.md`)
    ).toEqual(['nodes/x.md', 'nodes/y.md']);
    expect(extractCommandMarkdownCandidates('cat nodes/a.md,nodes/b.md')).toEqual([
      'nodes/a.md',
      'nodes/b.md',
    ]);
  });

  it('matches absolute markdown paths and ignores extensions like .md5', () => {
    expect(extractCommandMarkdownCandidates('cat /repo/.ai/kenkeep/nodes/z.md | rg foo')).toEqual([
      '/repo/.ai/kenkeep/nodes/z.md',
    ]);
    expect(extractCommandMarkdownCandidates('sha256sum nodes/checksum.md5')).toEqual([]);
  });

  it('returns [] for empty, non-string, or path-free command input without throwing', () => {
    expect(extractCommandMarkdownCandidates('')).toEqual([]);
    expect(extractCommandMarkdownCandidates(undefined)).toEqual([]);
    expect(extractCommandMarkdownCandidates(42)).toEqual([]);
    expect(extractCommandMarkdownCandidates('ls -la && git status')).toEqual([]);
  });
});

describe('extractClaudeReads', () => {
  it('returns file_path of Read tool_use blocks, ignoring other tools and text', () => {
    const text = [
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'reading' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/r/a.md' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/r/a.md' } }],
        },
      }),
      'not json',
    ].join('\n');
    expect(extractClaudeReads(text)).toEqual(['/r/a.md', '/r/a.md']);
  });

  it('returns [] when there are no reads', () => {
    expect(extractClaudeReads('')).toEqual([]);
  });

  it('interleaves Bash command candidates with Read paths in block order, preserving duplicates', () => {
    const text = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: '/r/a.md' } },
          { type: 'tool_use', name: 'Bash', input: { command: 'cat nodes/b.md nodes/b.md' } },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
        ],
      },
    });
    expect(extractClaudeReads(text)).toEqual(['/r/a.md', 'nodes/b.md', 'nodes/b.md']);
  });
});

describe('extractCursorReads', () => {
  it('returns input.path of Read/ReadFile blocks under message.content, ignoring search tools', () => {
    // cursor-agent emits `Read` (current, e.g. CLI 2026.06.x) and `ReadFile`
    // (older builds); both carry the path at input.path. Search tools ignored.
    const text = JSON.stringify({
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { offset: 0, limit: 1, path: '/r/a.md' } },
          { type: 'tool_use', name: 'ReadFile', input: { limit: 1, offset: 0, path: '/r/b.md' } },
          { type: 'tool_use', name: 'rg', input: { path: '/r', pattern: 'x' } },
        ],
      },
    });
    expect(extractCursorReads(text)).toEqual(['/r/a.md', '/r/b.md']);
  });

  it('adds command candidates from shell blocks and .md-naming search blocks, ignoring directory searches', () => {
    const text = JSON.stringify({
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Shell', input: { command: 'sed -n 1,5p nodes/a.md' } },
          { type: 'tool_use', name: 'Grep', input: { path: '/r/b.md', pattern: 'x' } },
          { type: 'tool_use', name: 'Grep', input: { path: '/r', pattern: 'x' } },
        ],
      },
    });
    expect(extractCursorReads(text)).toEqual(['nodes/a.md', '/r/b.md']);
  });
});

describe('extractCodexReads', () => {
  it('returns the path argument of read function_call items, ignoring shell calls', () => {
    const text = [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'read',
          arguments: JSON.stringify({ path: '/r/c.md' }),
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: JSON.stringify({ command: 'cat x' }),
        },
      }),
    ].join('\n');
    expect(extractCodexReads(text)).toEqual(['/r/c.md']);
  });

  it('extracts candidates from shell commands given as a string or an argv array', () => {
    const text = [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: JSON.stringify({ command: 'cat nodes/c.md' }),
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: JSON.stringify({ command: ['bash', '-lc', 'head .ai/kenkeep/nodes/d.md'] }),
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: 'not json',
        },
      }),
    ].join('\n');
    expect(extractCodexReads(text)).toEqual(['nodes/c.md', '.ai/kenkeep/nodes/d.md']);
  });
});

describe('extractCopilotReads', () => {
  it('returns data.arguments.path of view tool.execution_start events (real v1.0.61 shape)', () => {
    const text = [
      JSON.stringify({ type: 'user.message', data: { content: 'hi' } }),
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'view', arguments: { path: '/r/d.md' } },
      }),
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'bash', arguments: { command: 'ls' } },
      }),
    ].join('\n');
    expect(extractCopilotReads(text)).toEqual(['/r/d.md']);
  });

  it('extracts candidates from shell command execution events, ignoring malformed lines', () => {
    const text = [
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'bash', arguments: { command: 'cat nodes/d.md' } },
      }),
      'not json',
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'bash', arguments: { command: 'grep -n foo .' } },
      }),
    ].join('\n');
    expect(extractCopilotReads(text)).toEqual(['nodes/d.md']);
  });
});

describe('extractOpenCodeReads', () => {
  it('returns state.input.filePath of read tool parts, ignoring other tools and text', () => {
    const exportJson = {
      messages: [
        {
          role: 'assistant',
          parts: [
            { type: 'text', text: 'reading' },
            { type: 'tool', tool: 'read', state: { input: { filePath: '/r/e.md' } } },
            { type: 'tool', tool: 'bash', state: { input: { command: 'ls' } } },
          ],
        },
      ],
    };
    expect(extractOpenCodeReads(exportJson)).toEqual(['/r/e.md']);
  });

  it('returns [] for an empty object or absent messages', () => {
    expect(extractOpenCodeReads({})).toEqual([]);
    expect(extractOpenCodeReads(undefined)).toEqual([]);
  });

  it('interleaves read paths with bash command candidates in document order', () => {
    const exportJson = {
      messages: [
        {
          role: 'assistant',
          parts: [
            { type: 'tool', tool: 'read', state: { input: { filePath: '/r/e.md' } } },
            { type: 'tool', tool: 'bash', state: { input: { command: 'cat nodes/f.md' } } },
            { type: 'tool', tool: 'bash', state: { input: { command: 'ls -la' } } },
          ],
        },
      ],
    };
    expect(extractOpenCodeReads(exportJson)).toEqual(['/r/e.md', 'nodes/f.md']);
  });
});

describe('extractKiroReads', () => {
  function makeSession(assistantTexts: string[]): string {
    return JSON.stringify({
      session_id: 'test-id',
      session_state: {
        conversation_metadata: {
          user_turn_metadatas: assistantTexts.map(text => ({
            result: {
              Ok: {
                role: 'assistant',
                content: [{ kind: 'text', data: text }],
              },
            },
          })),
        },
      },
    });
  }

  it('returns [] for non-JSON or malformed input', () => {
    expect(extractKiroReads('null')).toEqual([]);
    expect(extractKiroReads('not-json')).toEqual([]);
    expect(extractKiroReads('{}')).toEqual([]);
  });

  it('extracts markdown path candidates from assistant response text', () => {
    const result = extractKiroReads(makeSession(['cat .ai/kenkeep/nodes/foo.md', 'rg term .ai/kenkeep/nodes/']));
    expect(result).toContain('.ai/kenkeep/nodes/foo.md');
  });

  it('returns [] when there are no markdown references', () => {
    expect(extractKiroReads(makeSession(['Hello! How can I help you today?']))).toEqual([]);
  });

  it('collects from multiple turns in document order', () => {
    const result = extractKiroReads(makeSession([
      'Reading .ai/kenkeep/nodes/a.md for context.',
      'Also checked .ai/kenkeep/nodes/b.md',
    ]));
    expect(result).toContain('.ai/kenkeep/nodes/a.md');
    expect(result).toContain('.ai/kenkeep/nodes/b.md');
    expect(result.indexOf('.ai/kenkeep/nodes/a.md')).toBeLessThan(
      result.indexOf('.ai/kenkeep/nodes/b.md')
    );
  });
});
