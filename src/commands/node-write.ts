import { existsSync, readFileSync } from 'node:fs';
import { text as readStdinText } from 'node:stream/consumers';
import {
  assertContentHash,
  assertSourceDoc,
  bootstrapStateFile,
  recordWrittenNode,
  updateBootstrapStateLocked,
  writtenInAttempt,
} from '../lib/bootstrap.js';
import { log, stderrLog } from '../lib/log.js';
import { deriveNodeId, ensureUniqueId, readAllNodes, writeNodeFile } from '../lib/nodes.js';
import { ledgerIds, readRedirectsLedger } from '../lib/redirects.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  ConfidenceSchema,
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  NodeKindSchema,
  type Confidence,
  type NodeFrontmatter,
  type NodeKind,
} from '../lib/schemas.js';

export interface NodeWriteFlags {
  title?: string;
  summary?: string;
  tags?: string;
  relatesTo?: string;
  dependsOn?: string;
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
 * tmp+rename, Zod-validated frontmatter and slug-collision resolution via
 * `ensureUniqueId` over the whole tree. The folder is presentation only; the
 * id is identity and is independent of placement. A folder that escapes
 * `nodes/` is rejected before any disk write.
 *
 * Body source: stdin by default, or `--from <path>`. Pick one.
 *
 * Stdout contract: on success, prints the final resolved node id (and
 * nothing else) so callers (skills) can capture it via `Bash`.
 *
 * Bootstrap provenance: `--source-doc <relpath>` and `--source-hash <sha256>`
 * come together (or not at all). The doc must be the repo-relative path
 * `finddocs` printed; it becomes the leaf's `kk_derived_from` entry. The
 * write is recorded in `bootstrap-state.json` under the document's
 * unfinished attempt (`in_progress`) and NEVER marks the document complete:
 * only `bootstrap complete-doc` does, once the skill has handled the whole
 * document. The node write and the record happen under the state lock, node
 * first; if recording fails the leaf stays on disk and the document stays
 * unfinished (safe: the next run reprocesses it). A retry of the same draft
 * (same derived id) in the same unfinished attempt writes nothing and prints
 * the id written the first time, so resuming an interrupted document never
 * lands a `-2` duplicate. Outside that case collisions still suffix (`-2`).
 */
export async function runNodeWriteCommand(
  args: NodeWriteArgs,
  deps: NodeWriteDeps = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
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
    const source =
      hasDoc && hasHash
        ? { doc: assertSourceDoc(root, sourceDoc), hash: assertContentHash(sourceHash) }
        : null;

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
    const dependsOn = parseList(args.flags.dependsOn ?? '');
    const confidence: Confidence = args.flags.confidence
      ? parseConfidence(args.flags.confidence)
      : 'high';

    const body = await readBody(args.flags.from, deps);
    const baseId = deriveNodeId(kind, slug);

    // Resolves the id over the whole tree, validates the frontmatter BEFORE
    // any disk write (a schema failure leaves no partial file), then writes
    // atomically (tmp+rename inside writeNodeFile). The folder is
    // presentation: a non-empty `--folder` places the leaf into that folder
    // under `nodes/`; empty/omitted lands at the root. `writeNodeFile`
    // rejects a folder that escapes `nodes/` before any write.
    const writeLeaf = (): string => {
      // Retired ids stay reserved: reusing one would rebind its redirect.
      const existingIds = ledgerIds(readRedirectsLedger(paths.nodesDir));
      for (const n of readAllNodes(paths.nodesDir)) existingIds.add(n.frontmatter.kk_id);
      const id = ensureUniqueId(existingIds, baseId);
      const candidate: NodeFrontmatter = {
        type: kind,
        title,
        description: summary,
        tags,
        kk_schema_version: NODE_SCHEMA_VERSION,
        kk_id: id,
        kk_derived_from: source ? [source.doc] : [],
        kk_relates_to: relatesTo,
        kk_depends_on: dependsOn,
        kk_confidence: confidence,
      };
      const validated = NodeFrontmatterSchema.safeParse(candidate);
      if (!validated.success) {
        const lines = validated.error.issues.map(
          i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`
        );
        throw new Error(`frontmatter validation failed:\n${lines.join('\n')}`);
      }
      const relDir = (args.flags.folder ?? '').trim();
      writeNodeFile({ nodesDir: paths.nodesDir, frontmatter: validated.data, body, relDir });
      return id;
    };

    let id: string;
    if (source === null) {
      id = writeLeaf();
    } else {
      id = await updateBootstrapStateLocked(bootstrapStateFile(paths.stateDir), state => {
        const already = writtenInAttempt(state, source.doc, source.hash, baseId);
        if (already !== undefined) {
          stderrLog.info(
            `${baseId} was already written as ${already} for ${source.doc} in this unfinished attempt; nothing written.`
          );
          return { next: null, result: already };
        }
        const written = writeLeaf();
        const next = recordWrittenNode(state, {
          doc: source.doc,
          hash: source.hash,
          derivedId: baseId,
          nodeId: written,
          now: new Date().toISOString(),
        });
        return { next, result: written };
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
