/**
 * The single user-facing instruction for migrating an out-of-date on-disk
 * knowledge base. Shared by the node reader (`OldLayoutError`) and
 * `init`/`upgrade` so the two surfaces never drift on the guidance.
 *
 * Migration is no longer a CLI command: the v1->v2 clustering runs in the host
 * agent's current session via the `kk-migrate` skill (no nested `<harness> -p`
 * spawn), which means a full migration now requires an interactive agent
 * session. The skill drives the deterministic `place` primitive to relocate the
 * leaves and leaves the result for `git diff` review. This constant is the one
 * place that names the skill so the reader and init cannot drift.
 */
export const MIGRATE_COMMAND_HINT =
  'the `/kk-migrate` skill in your agent session (migration now requires an interactive session)';
