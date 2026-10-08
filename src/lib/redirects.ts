import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from './fs-atomic.js';

/**
 * The redirects ledger filename, stored at the `nodes/` root as
 * `nodes/.redirects.json`. It is the "redirect in history" the plan requires:
 * when split-leaf retires an old id, the ledger records `old id -> [new ids]`
 * so a cross reference to the retired id can still be resolved. It is JSON, not
 * a leaf `.md`, so the node reader and the content hash both ignore it (it is
 * never a node and never perturbs `nodes_hash`).
 */
export const REDIRECTS_FILENAME = '.redirects.json';

const RedirectsLedgerSchema = z.record(z.string(), z.array(z.string()));
export type RedirectsLedger = z.infer<typeof RedirectsLedgerSchema>;

/**
 * Read the redirects ledger from `nodes/.redirects.json`. Returns an empty
 * ledger when the file is absent or unreadable; a corrupt ledger never aborts a
 * read path (lint/doctor/move all tolerate a missing ledger).
 */
export function readRedirectsLedger(nodesDir: string): RedirectsLedger {
  const file = join(nodesDir, REDIRECTS_FILENAME);
  if (!existsSync(file)) return {};
  try {
    const parsed = RedirectsLedgerSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/**
 * Persist the redirects ledger to `nodes/.redirects.json`, keys sorted for a
 * deterministic, diff-friendly file, via an atomic tmp+rename.
 */
export function writeRedirectsLedger(nodesDir: string, ledger: RedirectsLedger): void {
  const file = join(nodesDir, REDIRECTS_FILENAME);
  const sortedKeys = Object.keys(ledger).sort();
  const ordered: RedirectsLedger = {};
  for (const k of sortedKeys) ordered[k] = ledger[k] ?? [];
  atomicWriteJson(file, ordered);
}

/**
 * Resolve a (possibly retired) node id to the live ids that supersede it.
 * Follows the ledger transitively so a chain of splits (a -> b -> c) resolves
 * `a` to its final survivors. `live` is the set of ids that currently exist on
 * disk; only live ids are returned. An id that is itself live resolves to
 * itself. Returns an empty array when nothing in the chain is live.
 */
export function resolveRedirect(
  ledger: RedirectsLedger,
  live: ReadonlySet<string>,
  id: string
): string[] {
  if (live.has(id)) return [id];
  const out = new Set<string>();
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    const successors = ledger[current];
    if (!successors) continue;
    for (const next of successors) {
      if (live.has(next)) out.add(next);
      else if (!seen.has(next)) stack.push(next);
    }
  }
  return [...out].sort();
}

/**
 * Every id the ledger mentions, retired keys and successors alike. None may be
 * minted again: a new live leaf under a retired id makes `resolveRedirect`
 * prefer it, so every edge that reached the id's successors silently binds to
 * unrelated content; a successor that is no longer live is the same hazard one
 * hop later.
 */
export function ledgerIds(ledger: RedirectsLedger): Set<string> {
  const ids = new Set<string>();
  for (const [retired, successors] of Object.entries(ledger)) {
    ids.add(retired);
    for (const successor of successors) ids.add(successor);
  }
  return ids;
}

/**
 * Strict ledger parser for untrusted input (a pack's `knowledge/.redirects.json`).
 * Unlike `readRedirectsLedger`, which tolerates a corrupt consumer
 * ledger on read paths, this throws on malformed JSON or a shape other than
 * `{ <retired id>: [<successor id>, ...] }`, so a broken third-party ledger is
 * reported instead of silently merging as empty.
 */
export function parseRedirectsLedger(raw: string): RedirectsLedger {
  const parsed = RedirectsLedgerSchema.safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`ledger must map each retired id to an array of successor ids (${issues})`);
  }
  return parsed.data;
}

/** A retired id both ledgers record, with different successor sets. */
export interface RedirectCollision {
  id: string;
  existing: string[];
  incoming: string[];
}

/**
 * Merge `incoming` redirects into `base` (neither is mutated). A retired id
 * present in both with the same successor set (order-insensitive) is a no-op;
 * one mapped differently is a collision the caller must refuse, because
 * picking either side silently rewrites what the other side's edges mean.
 * Collisions are left out of `merged`.
 */
export function mergeRedirectsLedgers(
  base: RedirectsLedger,
  incoming: RedirectsLedger
): { merged: RedirectsLedger; collisions: RedirectCollision[] } {
  const merged: RedirectsLedger = { ...base };
  const collisions: RedirectCollision[] = [];
  for (const [id, successors] of Object.entries(incoming)) {
    const existing = base[id];
    if (existing === undefined) {
      merged[id] = [...successors];
      continue;
    }
    const left = [...new Set(existing)].sort();
    const right = [...new Set(successors)].sort();
    if (left.length !== right.length || left.some((value, i) => value !== right[i])) {
      collisions.push({ id, existing: left, incoming: right });
    }
  }
  return { merged, collisions };
}
