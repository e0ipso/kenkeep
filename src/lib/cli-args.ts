import { InvalidArgumentError } from 'commander';

/**
 * Build a commander custom argument parser that converts a string to an integer
 * and throws `InvalidArgumentError` on non-integer input. Commander prints the
 * thrown message and exits non-zero automatically.
 */
export function intArg(name: string): (value: string) => number {
  return value => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) {
      throw new InvalidArgumentError(`${name} must be an integer (got "${value}")`);
    }
    return n;
  };
}
