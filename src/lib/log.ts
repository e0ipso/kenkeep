import pc from 'picocolors';

type Level = 'info' | 'warn' | 'error' | 'success';

const paint: Record<Level, (s: string) => string> = {
  info: pc.cyan,
  warn: pc.yellow,
  error: pc.red,
  success: pc.green,
};

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  success: (msg: string) => void;
  plain: (msg: string) => void;
}

/**
 * Builds a logger. Warnings and errors always go to stderr. `statusStream`
 * picks where info/success/plain lines go: stdout for human-facing commands,
 * stderr for machine-output commands whose stdout must stay a single JSON
 * document.
 */
function createLogger(statusStream: 'stdout' | 'stderr'): Logger {
  // Resolve `console.*` per call (not once at load) so a later replacement of
  // the console method, e.g. a test spy, still receives the line.
  const status = (msg: string): void => {
    if (statusStream === 'stdout') console.log(msg);
    else console.error(msg);
  };
  const emit = (level: Level, prefix: string, message: string): void => {
    const line = `${paint[level](prefix)} ${message}`;
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      status(line);
    }
  };
  return {
    info: msg => emit('info', '•', msg),
    warn: msg => emit('warn', '!', msg),
    error: msg => emit('error', '✗', msg),
    success: msg => emit('success', '✓', msg),
    plain: msg => status(msg),
  };
}

/** Human-facing logger: status lines on stdout, warnings and errors on stderr. */
export const log: Logger = createLogger('stdout');

/**
 * Machine-output convention. A command that promises JSON on stdout (a skill
 * redirects or parses the whole stream) must:
 *
 * 1. report every diagnostic through `stderrLog`, and pass it down to any
 *    nested command it drives (e.g. `runIndexRebuild({ logger: stderrLog })`),
 *    so no status line from any depth reaches stdout;
 * 2. write its result once, via `writeJsonDocument`, and nothing else to stdout.
 */
export const stderrLog: Logger = createLogger('stderr');

/** Writes `value` as the command's single JSON document on stdout. */
export function writeJsonDocument(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
