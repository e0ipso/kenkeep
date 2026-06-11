import { describe, expect, it } from 'vitest';
import {
  extractClaudeReads,
  extractCodexReads,
  extractCopilotReads,
  extractCursorReads,
  extractOpenCodeReads,
} from '../../src/harnesses/read-extract.js';

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
});
