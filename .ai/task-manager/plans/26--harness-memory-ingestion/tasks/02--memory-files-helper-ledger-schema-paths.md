---
id: 2
group: "memory-helper"
dependencies: [1]
status: "pending"
created: 2026-05-21
skills:
  - typescript
---
# Implement `discoverHarnessMemoryFiles` helper, `MemoryLedgerSchema`, and ledger path

## Objective
Create `src/lib/memory-files.ts`, the shared module that consumes `adapter.listMemoryFiles()`, reads/hashes/secret-scans candidate files, consults and atomically updates the per-user ledger at `.ai/knowledge-base/.state/memory-ledger.json`, and exposes the candidate shapes that `bootstrap-incremental` and `curate` will consume in later tasks. Also add `memoryLedgerFile` to `RepoPaths` and `MemoryLedgerSchema` to `src/lib/schemas.ts`.

## Skills Required
- typescript (Zod schemas, async filesystem, hashing, atomic writes)

## Acceptance Criteria
- [ ] `src/lib/paths.ts` adds `memoryLedgerFile: join(stateDir, 'memory-ledger.json')` to `RepoPaths` and `repoPaths()`.
- [ ] `src/lib/schemas.ts` exports `MemoryLedgerSchema` (Zod) with `{ schema_version: z.literal(1), entries: z.record(z.string(), z.object({ sha256: z.string(), lastSeenRunId: z.string(), lastSeenAt: z.string() })) }`.
- [ ] `src/lib/memory-files.ts` exports:
  - `HARNESS_MEMORY_DISCOVERY_PROMPT` (verbatim from issue #37; canonical home — task 1 imports from here).
  - `loadMemoryLedger(paths)` — reads + Zod-validates the ledger, returns an empty in-memory ledger on missing/malformed file (with `log.warn` on malformed).
  - `discoverHarnessMemoryFiles(ctx)` — returns `{ bootstrapCandidates: DocCandidateFile[], curateCandidates: CurateMemoryCandidate[], commit: (runId, succeeded) => Promise<void> }`.
- [ ] The helper reads each IRI's file as UTF-8, computes SHA-256, compares against ledger; entries whose `sha256` matches are skipped (not returned).
- [ ] Remaining entries are passed through `scanAndRedact` from `src/lib/secret-scan.ts`; `blocked` results are logged and omitted; `redacted` content flows downstream.
- [ ] Empty / missing-on-disk / duplicate IRIs are handled per the plan's edge-case list (warn-and-skip, no ledger entry written for missing; de-dupe duplicates).
- [ ] `commit(runId, true)` updates ledger entries for every processed IRI to `{ sha256, lastSeenRunId: runId, lastSeenAt: new Date().toISOString() }` and writes via `atomicWriteJson`. `commit(runId, false)` is a no-op.
- [ ] `CurateMemoryCandidate` carries explicit provenance: `{ source: 'harness-memory', iri, sha256, content }`.
- [ ] `BootstrapContext.memoryCandidates` consumers receive `DocCandidateFile`-shaped entries; `relPath` is a synthetic `memory://<basename>` string so collision logic in bootstrap treats them as distinct from markdown paths.
- [ ] `npm run typecheck` and `npm run lint` pass.

## Technical Requirements
- Reuse `scanAndRedact` from `src/lib/secret-scan.ts`. Do not introduce a second scanner.
- Use `atomicWriteJson` from `src/lib/fs-atomic.ts` for ledger writes.
- Compute SHA-256 via `node:crypto` (`createHash('sha256').update(buf).digest('hex')`).
- `node:fs/promises` for file IO. Convert `file://` IRIs to absolute paths with `new URL(iri).pathname` (verify on Linux + macOS).

## Input Dependencies
- Task 1 — `HarnessAdapter.listMemoryFiles()` exists and Claude implementation returns IRIs.

## Output Artifacts
- New `src/lib/memory-files.ts`.
- Updated `src/lib/paths.ts` and `src/lib/schemas.ts`.

## Implementation Notes

<details>
<summary>Module shape</summary>

```ts
// src/lib/memory-files.ts
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { atomicWriteJson } from './fs-atomic.js';
import { log } from './log.js';
import { MemoryLedgerSchema, type MemoryLedger } from './schemas.js';
import { scanAndRedact } from './secret-scan.js';
import type { RepoPaths } from './paths.js';
import type { HarnessAdapter } from '../harnesses/types.js';
import type { DocCandidateFile } from './bootstrap.js';

export const HARNESS_MEMORY_DISCOVERY_PROMPT = `<verbatim from issue #37>`;

export interface CurateMemoryCandidate {
  source: 'harness-memory';
  iri: string;
  sha256: string;
  content: string;
}

export interface MemoryDiscoveryContext {
  adapter: HarnessAdapter;
  paths: RepoPaths;
}

export interface MemoryDiscoveryResult {
  bootstrapCandidates: DocCandidateFile[];
  curateCandidates: CurateMemoryCandidate[];
  commit: (runId: string, succeeded: boolean) => Promise<void>;
}

export async function loadMemoryLedger(paths: RepoPaths): Promise<MemoryLedger> {
  try {
    const raw = await readFile(paths.memoryLedgerFile, 'utf8');
    const parsed = MemoryLedgerSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      log.warn({ where: 'memory-ledger', err: parsed.error }, 'Ledger malformed; rebuilding from empty');
      return { schema_version: 1, entries: {} };
    }
    return parsed.data;
  } catch (err: unknown) {
    // ENOENT and other read errors fall through to empty
    return { schema_version: 1, entries: {} };
  }
}

export async function discoverHarnessMemoryFiles(
  ctx: MemoryDiscoveryContext,
): Promise<MemoryDiscoveryResult> {
  const iris = await ctx.adapter.listMemoryFiles();
  const ledger = await loadMemoryLedger(ctx.paths);
  const seen = new Set<string>();
  const pendingUpdates: Record<string, { sha256: string }> = {};
  const bootstrapCandidates: DocCandidateFile[] = [];
  const curateCandidates: CurateMemoryCandidate[] = [];

  for (const iri of iris) {
    if (seen.has(iri)) continue;
    seen.add(iri);
    if (!iri.startsWith('file://')) {
      log.warn({ iri }, 'Non-file IRI from listMemoryFiles; skipping');
      continue;
    }

    let absPath: string;
    try { absPath = fileURLToPath(iri); } catch (err) {
      log.warn({ iri, err }, 'Unparseable IRI');
      continue;
    }

    let buf: Buffer;
    try { buf = await readFile(absPath); } catch (err) {
      log.warn({ iri, absPath, err }, 'Memory file missing on disk; skipping');
      continue;
    }
    if (buf.length === 0) continue;

    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (ledger.entries[iri]?.sha256 === sha256) continue;

    const scan = await scanAndRedact(buf.toString('utf8'));
    if (scan.blocked) {
      log.error({ iri }, 'Secretlint blocked memory file; omitting');
      continue;
    }

    pendingUpdates[iri] = { sha256 };
    const basename = absPath.split('/').pop() ?? 'memory';
    bootstrapCandidates.push({
      relPath: `memory://${basename}`,
      absPath,
      sha256,
      content: scan.text,
    } as DocCandidateFile);
    curateCandidates.push({ source: 'harness-memory', iri, sha256, content: scan.text });
  }

  return {
    bootstrapCandidates,
    curateCandidates,
    commit: async (runId, succeeded) => {
      if (!succeeded) return;
      const now = new Date().toISOString();
      for (const [iri, { sha256 }] of Object.entries(pendingUpdates)) {
        ledger.entries[iri] = { sha256, lastSeenRunId: runId, lastSeenAt: now };
      }
      atomicWriteJson(ctx.paths.memoryLedgerFile, ledger);
    },
  };
}
```

(If `DocCandidateFile` does not currently carry `absPath` / `sha256` / `content` exactly as shown above, adapt the helper's `bootstrapCandidates` mapping to whatever shape `runBootstrapIncremental` reads — the goal is for the bootstrap candidate to look like any other markdown candidate at the call site.)

In `src/lib/schemas.ts` add:

```ts
export const MemoryLedgerSchema = z.object({
  schema_version: z.literal(1),
  entries: z.record(
    z.string(),
    z.object({
      sha256: z.string(),
      lastSeenRunId: z.string(),
      lastSeenAt: z.string(),
    }),
  ),
});
export type MemoryLedger = z.infer<typeof MemoryLedgerSchema>;
```

In `src/lib/paths.ts` add:

```ts
memoryLedgerFile: join(stateDir, 'memory-ledger.json'),
```

Do **not** add tests here; task 6 covers them.
</details>
