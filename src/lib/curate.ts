import { readFileSync } from 'node:fs';
import { atomicWriteFile } from './fs-atomic.js';
import matter from 'gray-matter';
import { deriveNodeId } from './nodes.js';
import { withSessionLogLock } from './session-log.js';
import {
  type CuratorAction,
  type CuratorContradictAction,
  type CuratorModifyAction,
} from './schemas.js';

/**
 * Cross-batch dedup. Keys are namespaced per action kind so kinds never
 * compete with each other:
 *
 * - `add` / `modify` share `node:<id>` (the modify target, or the slug derived
 *   from type+title): two proposals for the same node collapse into one, the
 *   higher confidence wins and a tie keeps the earliest input.
 * - `drop` is keyed by `candidate_origin`.
 * - `contradict` is keyed by target *and* origin, so a contradiction is never
 *   outranked by a modify or by another contradiction of the same target; only
 *   an exact re-submission of the same origin collapses.
 *
 * Then, for every target with a surviving contradiction, any surviving
 * `modify` of that target is **held**: it is re-emitted as a `contradict`
 * action carrying the modify's full proposal and a rationale that explains
 * the hold. The dedup primitive materializes it as a pending conflict next to
 * the contradiction (same `target_node_id`, so `conflict prepare` groups
 * them), and the human decides whether the rewrite still applies. A target
 * with contradictory evidence is therefore never modified without that
 * decision, regardless of confidence or input order.
 */
export function dedupActions(actions: CuratorAction[]): CuratorAction[] {
  const byKey = new Map<string, CuratorAction>();
  for (const action of actions) {
    switch (action.action) {
      case 'drop':
        byKey.set(`drop:${action.candidate_origin}`, action);
        break;
      case 'contradict':
        byKey.set(`contradict:${action.target_node_id}:${action.candidate_origin}`, action);
        break;
      case 'add':
      case 'modify': {
        const id =
          action.action === 'modify'
            ? action.target_node_id
            : deriveNodeId(action.proposed_node.type, action.proposed_node.title);
        const key = `node:${id}`;
        const existing = byKey.get(key);
        if (!existing || rankConfidence(action) > rankConfidence(existing)) {
          byKey.set(key, action);
        }
        break;
      }
    }
  }
  const contradicted = new Set<string>();
  for (const action of byKey.values()) {
    if (action.action === 'contradict') contradicted.add(action.target_node_id);
  }
  return [...byKey.values()].map(action =>
    action.action === 'modify' && contradicted.has(action.target_node_id)
      ? holdModify(action)
      : action
  );
}

/**
 * Turns a modify whose target has contradictory evidence into a conflict
 * record the human reviews alongside that contradiction. The proposal is
 * carried verbatim; only the rationale gains the hold explanation.
 */
function holdModify(action: CuratorModifyAction): CuratorContradictAction {
  return {
    action: 'contradict',
    candidate_origin: action.candidate_origin,
    target_node_id: action.target_node_id,
    proposed_node: action.proposed_node,
    rationale:
      `Held for human review: a contradiction against ${action.target_node_id} was reported ` +
      `in the same run, so this modification was not applied automatically. ` +
      `Original rationale: ${action.rationale}`,
  };
}

function rankConfidence(action: CuratorAction): number {
  if (action.action !== 'add' && action.action !== 'modify') return 0;
  const node = action.proposed_node;
  return node.kk_confidence === 'high' ? 3 : node.kk_confidence === 'medium' ? 2 : 1;
}

/**
 * One session a run consumed: the log's path and the transcript version the
 * caller validated against the run's drafts before any write.
 */
export interface SessionStamp {
  path: string;
  transcript_hash: string;
  transcript_chars?: number | undefined;
}

/**
 * Stamps `curator_processed_at` / `curator_run_id` and the consumed version
 * (`curated_transcript_hash` / `curated_transcript_chars`) into the
 * frontmatter of each given session log. The caller (`curate dedup`) passes
 * exactly the sessions it validated against the run's drafts, with the
 * version it validated; this never enumerates `_sessions/` itself.
 *
 * The version is taken from the caller, never read back from the file. By
 * the time this runs, the survivors and conflicts are already on disk, and a
 * capture may have moved the log to a newer transcript since validation.
 * Copying the file's current hash would mark that newer transcript curated
 * although nobody curated it, and its turns would never reach curation.
 * Writing the consumed version instead leaves such a log `outdated` (see
 * `curationState`): the new turns stay pending for the next run, the prefix
 * up to `curated_transcript_chars` stays out of extraction, and the writes
 * already made are not stranded by refusing the stamp.
 *
 * Each read and rename holds the session log lock shared with capture and
 * proposal write-back. Without it, a capture landing between the read and
 * the rename would be replaced by the older transcript read here.
 */
export async function markSessionsProcessed(
  stamps: SessionStamp[],
  runId: string,
  now: Date
): Promise<void> {
  for (const stamp of stamps) {
    await withSessionLogLock(stamp.path, () => stampSession(stamp, runId, now));
  }
}

function stampSession(stamp: SessionStamp, runId: string, now: Date): void {
  const parsed = matter(readFileSync(stamp.path, 'utf8'));
  const data = { ...(parsed.data as Record<string, unknown>) };
  data['curator_processed_at'] = now.toISOString();
  data['curator_run_id'] = runId;
  data['curated_transcript_hash'] = stamp.transcript_hash;
  if (typeof stamp.transcript_chars === 'number') {
    data['curated_transcript_chars'] = stamp.transcript_chars;
  } else {
    delete data['curated_transcript_chars'];
  }
  const serialized = matter.stringify(parsed.content, data);
  // tmp+rename: a crash mid-write must not truncate the session log into an
  // unparseable file the next sweep would silently drop.
  atomicWriteFile(stamp.path, serialized);
}

/**
 * Mints the deterministic conflict-file id used by the `curate dedup`
 * primitive. The shape `${runId}-${n}` is the authoritative public contract
 * for conflict filenames — keep this helper in sync with any test that
 * asserts it.
 */
export function mintConflictId(runId: string, n: number): string {
  return `${runId}-${n}`;
}
