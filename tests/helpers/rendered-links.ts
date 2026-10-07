import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Every non-URL markdown link target in a file, in order. */
export function localHrefs(file: string): string[] {
  const content = readFileSync(file, 'utf8');
  return [...content.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(m => m[1]!)
    .filter(href => !URL_PATTERN.test(href));
}

/**
 * The local hrefs in `file` that do NOT resolve to an existing file when read
 * the way GitHub and plain markdown readers do: relative to the file's own
 * directory. Empty means every rendered link works.
 */
export function unresolvedHrefs(file: string): string[] {
  return localHrefs(file).filter(href => !existsSync(resolve(dirname(file), href.split('#')[0]!)));
}
