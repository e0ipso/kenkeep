/**
 * Back-compat re-export. The canonical headless runner now lives at
 * `src/harnesses/claude/headless.ts`. Importing through this module
 * remains supported for existing tests and call sites.
 */
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../harnesses/types.js';

export type {
  HeadlessRunOptions as RunHeadlessOptions,
  HeadlessStreamMessage as StreamJsonMessage,
};
export { runHeadlessClaude, DEFAULT_TIMEOUT_MS } from '../harnesses/claude/headless.js';
