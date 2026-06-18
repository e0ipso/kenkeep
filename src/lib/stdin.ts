export interface ReadStdinOptions {
  /**
   * Maximum time to wait for stdin EOF before resolving with whatever has
   * arrived so far. Use for the async launcher's pre-launch capture, where the
   * read must never block on a host that holds stdin open without sending EOF.
   * Omit to wait indefinitely for EOF (the default for context hooks whose host
   * always closes stdin).
   */
  deadlineMs?: number;
}

export function readStdin(options: ReadStdinOptions = {}): Promise<string> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (value: string): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      // Release the stdin handle so a lingering open pipe cannot keep the
      // process alive once the caller has what it needs (e.g. the launcher
      // parent must be free to exit after a bounded capture).
      process.stdin.pause();
      resolve(value);
    };
    if (options.deadlineMs !== undefined) {
      timer = setTimeout(() => finish(data), options.deadlineMs);
      timer.unref();
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => finish(data));
    process.stdin.on('error', () => finish(''));
  });
}
