import { randomBytes } from 'node:crypto';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

/**
 * Generates a Crockford Base32 ULID (26 characters). The first 10 chars
 * encode milliseconds since the Unix epoch; the remaining 16 are
 * cryptographic randomness. Lexicographic order matches time order.
 */
export function ulid(now: Date = new Date()): string {
  const ms = now.getTime();
  const time = encodeTime(ms);
  const random = encodeRandom();
  return `${time}${random}`;
}

function encodeTime(ms: number): string {
  let value = ms;
  const out: string[] = new Array<string>(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i -= 1) {
    const mod = value % 32;
    out[i] = ENCODING[mod]!;
    value = (value - mod) / 32;
  }
  return out.join('');
}

function encodeRandom(): string {
  const bytes = randomBytes(RANDOM_LEN);
  const out: string[] = new Array<string>(RANDOM_LEN);
  for (let i = 0; i < RANDOM_LEN; i += 1) {
    out[i] = ENCODING[bytes[i]! % 32]!;
  }
  return out.join('');
}
