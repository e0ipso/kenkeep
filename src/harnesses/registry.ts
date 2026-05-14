import { claudeAdapter } from './claude/index.js';
import type { HarnessAdapter } from './types.js';

/**
 * Plugin registry of available harness adapters. Add a new adapter by
 * dropping a sibling directory under `src/harnesses/` that exports a
 * `HarnessAdapter` and registering it here.
 *
 * The registry is intentionally a plain map — every consumer surface
 * (`init`, `doctor`, `curate`, …) goes through `getHarness(id)` so the
 * rest of the codebase has no knowledge of which assistants exist.
 */
const ADAPTERS: Readonly<Record<string, HarnessAdapter>> = {
  [claudeAdapter.id]: claudeAdapter,
};

export function listHarnessIds(): string[] {
  return Object.keys(ADAPTERS).sort();
}

export function getHarness(id: string): HarnessAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) {
    throw new Error(`Unsupported assistant '${id}'. Supported: ${listHarnessIds().join(', ')}.`);
  }
  return adapter;
}

export function hasHarness(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id);
}
