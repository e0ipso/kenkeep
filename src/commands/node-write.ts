import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { text as readStdinText } from 'node:stream/consumers';
import lockfile from 'proper-lockfile';
import { readBootstrapState, writeBootstrapState } from '../lib/bootstrap.js';
import { log } from '../lib/log.js';
import { deriveNodeId, ensureUniqueId, readAllNodes, writeNodeFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths, type RepoPaths } from '../lib/paths.js';
import { STATE_LOCK_OPTIONS } from '../lib/state.js';
import {
  ConfidenceSchema,
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  NodeKindSchema,
  type BootstrapState,
  type Confidence,
  type NodeFrontmatter,
  type NodeKind,
} from '../lib/schemas.js';

export interface NodeWriteFlags {
  title?: string;
  summary?: string;
  tags?: string;
  relatesTo?: string;
  confidence?: string;
  from?: string;
  sourceDoc?: string;
  sourceHash?: string;
  /**
   * Target home folder relative to `nodes/` (POSIX-style). When omitted or
   * empty, the leaf lands at the `nodes/` root (the deliberate root fallback).
   * Placement is presentation only; the resolved id is folder-independent.
   */
  folder?: string;
}

export interface NodeWriteDeps {
  /** Reads body content from stdin. Injected for tests. */
  readStdin?: () => Promise<string>;
  /** Whether stdin is a TTY (no piped body). Injected for tests. */
  isTTY?: () => boolean;
  /** Writer of the final resolved id to stdout. Injected for tests. */
  writeStdout?: (s: string) => void;
}

export interface NodeWriteArgs {
  kind: string;
  slug: string;
  flags: NodeWriteFlags;
}

/**
 * Headless primitive: write a single node to `nodes/<folder>/<id>.md` (or
 * `nodes/<id>.md` at the root when `--folder` is omitted) with atomic
 * tmp+rename, Zod-validated frontmatter, slug-collision resolution via
 * `ensureUniqueId` over the whole tree, and (optionally) folded
 * `bootstrap-state.json` hash-map update. The folder is presentation only; the
 * id is identity and is independent of placement. A folder that escapes
 * `nodes/` is rejected before any disk write.
 *
 * Body source: stdin by default, or `--from <path>`. Pick one.
 *
 * Stdout contract: on success, prints the final resolved node id (and
 * nothing else) so callers (skills) can capture it via `Bash`.
 *
 * State-fold: when BOTH `--source-doc <relpath>` and `--source-hash <sha256>`
 * are provided, the per-file hash map in `bootstrap-state.json` is updated
 * in the same invocation. Order: write the node file first; then update
 * bootstrap-state. If the second step fails, the node file is on disk and
 * the next bootstrap run will see "node exists but no hash recorded" and
 * recompute, which is the desired safe failure mode. The two writes are
 * not transactionally linked — single-author atomic writes are sufficient
 * for this tool's concurrency model (cf. plan 31, "minimum viable set").
 */
export async function runNodeWriteCommand(
  args: NodeWriteArgs,
  deps: NodeWriteDeps = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses claude`.'
    );
    return 1;
  }

  const writeStdout = deps.writeStdout ?? ((s: string) => process.stdout.write(s));

  try {
    const kind = parseKind(args.kind);
    const slug = (args.slug ?? '').trim();
    if (!slug) {
      throw new Error('positional <slug> is required');
    }

    const { sourceDoc, sourceHash } = args.flags;
    const hasDoc = sourceDoc !== undefined && sourceDoc !== '';
    const hasHash = sourceHash !== undefined && sourceHash !== '';
    if (hasDoc !== hasHash) {
      throw new Error(
        '--source-doc and --source-hash must be provided together (or neither); no writes performed.'
      );
    }

    const title = (args.flags.title ?? '').trim();
    if (!title) {
      throw new Error('--title is required');
    }
    const summary = (args.flags.summary ?? '').trim();
    if (!summary) {
      throw new Error('--summary is required');
    }
    const tags = parseList(args.flags.tags ?? '');
    const relatesTo = parseList(args.flags.relatesTo ?? '');
    const confidence: Confidence = args.flags.confidence
      ? parseConfidence(args.flags.confidence)
      : 'high';

    const body = await readBody(args.flags.from, deps);

    const existingIds = new Set(readAllNodes(paths.nodesDir).map(n => n.frontmatter.id));
    const baseId = deriveNodeId(kind, slug);
    const id = ensureUniqueId(existingIds, baseId);

    // Build + validate frontmatter BEFORE any disk write so a schema
    // failure leaves no partial file on disk.
    const candidate: NodeFrontmatter = {
      schema_version: NODE_SCHEMA_VERSION,
      id,
      title,
      kind,
      tags,
      derived_from: [],
      relates_to: relatesTo,
      confidence,
      summary,
    };
    const validated = NodeFrontmatterSchema.safeParse(candidate);
    if (!validated.success) {
      const lines = validated.error.issues.map(
        i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`
      );
      throw new Error(`frontmatter validation failed:\n${lines.join('\n')}`);
    }

    // 1) Write the node file (atomic tmp+rename inside writeNodeFile). The
    //    folder is presentation: a non-empty `--folder` places the leaf into
    //    that existing folder under `nodes/`; empty/omitted lands at the root.
    //    `writeNodeFile` rejects a folder that escapes `nodes/` before any write.
    const relDir = (args.flags.folder ?? '').trim();
    writeNodeFile({ nodesDir: paths.nodesDir, frontmatter: validated.data, body, relDir });

    // 2) If both source flags were provided, fold the per-file hash-map
    //    update into the same invocation. Separate atomic write; if this
    //    fails after step 1 succeeded, the node is on disk without a
    //    state entry — next bootstrap recomputes (safe).
    if (hasDoc && hasHash) {
      await updateBootstrapState({
        paths,
        sourceDoc: sourceDoc!,
        sourceHash: sourceHash!,
        nodeId: id,
      });
    }

    // Stdout contract: ONLY the id, no trailing context, no log noise on
    // the success path. The skill captures this via Bash output.
    writeStdout(`${id}\n`);
    return 0;
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

interface UpdateBootstrapStateArgs {
  paths: RepoPaths;
  sourceDoc: string;
  sourceHash: string;
  nodeId: string;
}

async function updateBootstrapState(args: UpdateBootstrapStateArgs): Promise<void> {
  const file = join(args.paths.stateDir, 'bootstrap-state.json');
  // `proper-lockfile` requires the target to exist. Lazy-create an empty
  // placeholder before acquiring the lock so the first concurrent writer
  // has something to lock against.
  if (!existsSync(file)) {
    writeBootstrapState(file, { schema_version: 1, docs: {} });
  }
  // Retry on contention so concurrent host sub-agents serialise on the
  // RMW rather than failing fast (cf. proposal-drain, which intentionally
  // bails on ELOCKED for the single-drainer contract).
  const release = await lockfile.lock(file, {
    ...STATE_LOCK_OPTIONS,
    retries: { retries: 10, minTimeout: 25, maxTimeout: 200, factor: 1.5 },
  });
  try {
    const current = readBootstrapState(file);
    const existing = current.docs[args.sourceDoc];
    const producedNodes = existing
      ? Array.from(new Set([...existing.produced_nodes, args.nodeId]))
      : [args.nodeId];
    const next: BootstrapState = {
      schema_version: 1,
      ...(current.last_full_bootstrap_at !== undefined
        ? { last_full_bootstrap_at: current.last_full_bootstrap_at }
        : {}),
      last_incremental_at: new Date().toISOString(),
      docs: {
        ...current.docs,
        [args.sourceDoc]: {
          content_sha256: args.sourceHash,
          last_processed_at: new Date().toISOString(),
          produced_nodes: producedNodes,
        },
      },
    };
    writeBootstrapState(file, next);
  } finally {
    await release();
  }
}

async function readBody(fromPath: string | undefined, deps: NodeWriteDeps): Promise<string> {
  if (fromPath !== undefined && fromPath !== '') {
    if (!existsSync(fromPath)) {
      throw new Error(`--from ${fromPath}: file does not exist`);
    }
    return readFileSync(fromPath, 'utf8');
  }
  const isTTY = deps.isTTY ?? (() => Boolean(process.stdin.isTTY));
  if (isTTY()) {
    throw new Error(
      'no body source: provide --from <path> or pipe body on stdin (e.g. `... <<EOF ... EOF`).'
    );
  }
  const readStdin = deps.readStdin ?? (() => readStdinText(process.stdin));
  return readStdin();
}

function parseKind(value: string): NodeKind {
  const result = NodeKindSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`<kind> must be one of practice|map (got "${value}")`);
  }
  return result.data;
}

function parseConfidence(value: string): Confidence {
  const result = ConfidenceSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`--confidence must be one of low|medium|high (got "${value}")`);
  }
  return result.data;
}

function parseList(s: string): string[] {
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}
