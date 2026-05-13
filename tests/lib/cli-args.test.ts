import { InvalidArgumentError } from 'commander';
import { describe, expect, it } from 'vitest';
import { intArg } from '../../src/lib/cli-args.js';

describe('intArg', () => {
  it('parses integer strings', () => {
    const parse = intArg('--timeout');
    expect(parse('5000')).toBe(5000);
    expect(parse('0')).toBe(0);
    expect(parse('-12')).toBe(-12);
  });

  it('throws InvalidArgumentError on non-integer input', () => {
    const parse = intArg('--timeout');
    expect(() => parse('abc')).toThrow(InvalidArgumentError);
    expect(() => parse('abc')).toThrow(/--timeout must be an integer \(got "abc"\)/);
  });

  it('throws on empty string', () => {
    const parse = intArg('--batch-size');
    expect(() => parse('')).toThrow(InvalidArgumentError);
    expect(() => parse('')).toThrow(/--batch-size/);
  });

  it('accepts numeric strings with leading whitespace (parseInt semantics)', () => {
    const parse = intArg('--n');
    expect(parse(' 42')).toBe(42);
  });
});
