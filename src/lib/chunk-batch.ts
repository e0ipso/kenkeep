export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || !Number.isInteger(size)) {
    throw new Error(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
