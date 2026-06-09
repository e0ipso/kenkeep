import { describe, expect, it } from 'vitest';
import { extractJsonPayload } from '../../src/lib/json-extract.js';

describe('extractJsonPayload', () => {
  it('returns raw object and array payloads unchanged after trimming', () => {
    expect(extractJsonPayload('  {"hello":"world"}  ')).toBe('{"hello":"world"}');
    expect(extractJsonPayload('\n[1, 2, 3]\n')).toBe('[1, 2, 3]');
  });

  it('unwraps fenced blocks (json-tagged and bare), including those preceded by prose', () => {
    expect(JSON.parse(extractJsonPayload('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
    expect(JSON.parse(extractJsonPayload('```\n[true, false]\n```'))).toEqual([true, false]);
    expect(
      JSON.parse(extractJsonPayload('Sure, here is the JSON:\n\n```json\n{"ok":true}\n```'))
    ).toEqual({ ok: true });
  });

  it('skips a fenced non-JSON block and returns the last balanced object from prose', () => {
    expect(
      JSON.parse(
        extractJsonPayload('Background:\n```bash\necho hi\n```\nAnswer:\n```json\n{"x":42}\n```')
      )
    ).toEqual({ x: 42 });
    expect(
      JSON.parse(extractJsonPayload('First I considered {"draft":1} but the answer is {"final":2}'))
    ).toEqual({ final: 2 });
  });

  it('respects braces and escaped quotes embedded in string values', () => {
    const raw = 'reply: {"text":"a } inside and a { too","msg":"she said \\"hi\\"","ok":true}';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({
      text: 'a } inside and a { too',
      msg: 'she said "hi"',
      ok: true,
    });
  });

  it('returns trimmed input for plain prose and unbalanced fragments so downstream parse fails', () => {
    expect(extractJsonPayload('  no json here at all  ')).toBe('no json here at all');
    expect(() => JSON.parse(extractJsonPayload('partial: {"a":1'))).toThrow();
  });

  it('returns empty string for empty input', () => {
    expect(extractJsonPayload('')).toBe('');
    expect(extractJsonPayload('   \n  ')).toBe('');
  });
});
