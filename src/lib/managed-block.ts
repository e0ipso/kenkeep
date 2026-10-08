/**
 * Shared malformed-sentinel policy for every kenkeep writer that maintains a
 * marker-delimited block inside a user-owned file (the AGENTS.md pointer
 * block, the OpenCode `.gitignore` block, the Copilot instructions block).
 *
 * A marker counts only when it occupies a whole line (surrounding whitespace
 * ignored), so prose that merely quotes a marker inline stays user text. The
 * file is then in exactly one of three states:
 *   - no start and no end marker line: the block is absent (callers append);
 *   - exactly one start line followed later by exactly one end line: the block
 *     spans those lines inclusive (callers replace it in place);
 *   - anything else (orphaned start, orphaned end, duplicated or reversed
 *     markers): malformed. We never guess where the managed region ends, since
 *     every guess can swallow user text, so the caller gets a
 *     `MalformedManagedBlockError` naming the file and must leave it untouched.
 */
export interface ManagedBlockMarkers {
  start: string;
  end: string;
}

export type ManagedBlockSplit =
  | { found: false }
  | {
      found: true;
      /** Everything before the start marker line (empty or ending in a newline). */
      before: string;
      /** Everything after the end marker line and its line terminator. */
      after: string;
    };

export class MalformedManagedBlockError extends Error {
  constructor(
    readonly file: string,
    detail: string,
    markers: ManagedBlockMarkers
  ) {
    super(
      `${file}: the kenkeep-managed block is malformed (${detail}). kenkeep left the file ` +
        `unchanged so no text outside the block is lost. Edit it so the "${markers.start}" ` +
        `and "${markers.end}" lines each appear exactly once, start before end (or delete ` +
        `both so the block is re-appended), then re-run the command.`
    );
    this.name = 'MalformedManagedBlockError';
  }
}

interface MarkerLine {
  /** Offset of the first character of the line. */
  lineStart: number;
  /** Offset just past the line terminator (or EOF on the last line). */
  next: number;
}

function markerLines(text: string, marker: string): MarkerLine[] {
  const found: MarkerLine[] = [];
  let lineStart = 0;
  while (lineStart < text.length) {
    const nl = text.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? text.length : nl;
    const next = nl === -1 ? text.length : nl + 1;
    if (text.slice(lineStart, lineEnd).trim() === marker) found.push({ lineStart, next });
    lineStart = next;
  }
  return found;
}

/**
 * Locates the managed block in `text` under the shared policy above. Throws
 * `MalformedManagedBlockError` (naming `file`) for any marker layout other
 * than "none" or "one ordered pair".
 */
export function splitManagedBlock(
  text: string,
  markers: ManagedBlockMarkers,
  file: string
): ManagedBlockSplit {
  const starts = markerLines(text, markers.start);
  const ends = markerLines(text, markers.end);
  if (starts.length === 0 && ends.length === 0) return { found: false };
  if (starts.length !== 1 || ends.length !== 1) {
    throw new MalformedManagedBlockError(
      file,
      `found ${starts.length} start marker line(s) and ${ends.length} end marker line(s)`,
      markers
    );
  }
  const [start] = starts as [MarkerLine];
  const [end] = ends as [MarkerLine];
  if (end.lineStart < start.lineStart) {
    throw new MalformedManagedBlockError(file, 'the end marker precedes the start marker', markers);
  }
  return { found: true, before: text.slice(0, start.lineStart), after: text.slice(end.next) };
}

/**
 * Returns `existing` with the managed block set to `body`: replaced in place
 * when present, appended after a blank line when absent, or the whole file
 * when `existing` is empty. Text outside the block is preserved byte-for-byte
 * and the result always ends with a newline. Throws
 * `MalformedManagedBlockError` instead of rewriting a malformed file.
 */
export function upsertManagedBlock(
  existing: string,
  markers: ManagedBlockMarkers,
  body: string,
  file: string
): string {
  const block = `${markers.start}\n${body}\n${markers.end}`;
  const split = splitManagedBlock(existing, markers, file);
  if (split.found) {
    const next = `${split.before}${block}\n${split.after}`;
    return next.endsWith('\n') ? next : `${next}\n`;
  }
  if (existing.length === 0) return `${block}\n`;
  const sep = existing.endsWith('\n') ? '' : '\n';
  return `${existing}${sep}\n${block}\n`;
}
