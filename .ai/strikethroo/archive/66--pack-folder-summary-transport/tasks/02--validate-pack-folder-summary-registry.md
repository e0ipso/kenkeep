---
id: 2
group: "pack-transport"
dependencies: []
status: "completed"
created: 2026-08-05
skills:
  - typescript
  - secure-coding
complexity_score: 6
complexity_notes: "Validates untrusted third-party pack content; path-traversal rejection must be correct and must run before any consumer state is written."
execution_profile: "complex-architecture"
---
# Validate the pack folder summary registry in `validatePack`

## Objective

Teach `validatePack` to treat a pack-shipped folder summary registry as untrusted input: parse it against `FolderSummaryRegistrySchema`, reject schema failures and traversal-escaping keys as errors, and report folders present in `knowledge/` with no registry entry as warnings. An absent registry file must remain valid.

## Skills Required

- **typescript** — editing `src/lib/pack.ts` and using Zod's `safeParse` result shape.
- **secure-coding** — reasoning about path traversal in keys supplied by a third-party pack.

## Acceptance Criteria

- [ ] `validatePack` in `src/lib/pack.ts` reads the registry at the pack root when present, using `readFolderSummaries` semantics for path resolution (the file for `<packRoot>/knowledge`).
- [ ] A pack with **no** registry file validates successfully with no error and no registry-related warning about the file's absence.
- [ ] A registry whose frontmatter fails `FolderSummaryRegistrySchema` pushes onto `errors` (not `warnings`), with per-issue lines rendered through the existing `formatIssue` helper, matching the manifest failure shape at `src/lib/pack.ts:67-74`.
- [ ] A registry containing a key that escapes the knowledge tree (`../evil`, `../../x`, `/abs`, or any key normalizing outside the tree) pushes an error naming the offending key, and `ok` is `false`.
- [ ] Malformed YAML / unparseable registry frontmatter is an error, not an uncaught throw.
- [ ] Folders present in `knowledge/` with no registry entry push onto `warnings`, and `ok` stays `true` when there are no errors.
- [ ] Runnable verification: `npx tsc --noEmit` from `/workspace` exits `0`.
- [ ] Runnable verification: from `/workspace`, run `npx vitest run tests/lib/pack.test.ts` — expected: all pre-existing cases still pass (no regressions introduced by the new pass).
- [ ] Runnable verification (manual, proves error-before-write): build with `npm run build`, copy any exported pack to `/tmp/kk-t2-evil`, hand-edit its `knowledge.FOLDER_SUMMARIES.md` to add a `'../../../evil': "x"` key, then from a kenkeep-initialized sandbox run `node /workspace/dist/cli.js pack import /tmp/kk-t2-evil`. Expected: non-zero exit and an error line naming `../../../evil`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Edit only `src/lib/pack.ts`.
- Reuse `FolderSummaryRegistrySchema` from `src/lib/folder-summaries.ts` unchanged — the schema needs no modification, because `summaries` is `z.record(z.string())` with no completeness constraint, so a partial registry is already representable.
- Reuse `formatIssue` from `src/lib/nodes.js`, already imported at `src/lib/pack.ts:4-9`.
- Push onto the existing `errors` / `warnings` arrays that `validatePack` already returns; do not change the `PackValidationResult` interface.

## Input Dependencies

None. This task can start immediately and runs in parallel with task 1.

## Output Artifacts

- `validatePack` rejecting malformed and hostile registries, and warning on incomplete ones.
- The safety guarantee task 3 relies on: by the time import merges, every surviving key is known non-escaping.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Where to insert.** `validatePack` at `src/lib/pack.ts:89-139` currently: validates the manifest, checks `knowledge/` exists and is a directory, calls `readAllNodes(knowledgeDir)`, then loops nodes for naming and duplicate-id errors, then returns. Add the registry pass after the node loop and before the final `return`, so node-level errors still short-circuit first.

**Resolving the file.** The registry lives at the pack root as `knowledge.FOLDER_SUMMARIES.md`. Resolve it with `folderSummariesFileForNodesDir(join(packRoot, PACK_KNOWLEDGE_DIRNAME))` imported from `./folder-summaries.js` — that function returns `<packRoot>/knowledge.FOLDER_SUMMARIES.md` for a directory named `knowledge` (`src/lib/folder-summaries.ts:18-21`). Do not hardcode the filename string.

**Absent file is valid.** If the resolved file does not exist, add nothing to `errors` and add no warning about the file itself, then fall through to the missing-entry warnings below (which will warn about every folder, since there are zero entries). This is the backwards-compatibility contract: packs published before this change carry no registry and must keep importing.

**Parsing.** Do not call `readFolderSummaries` here — it uses `FolderSummaryRegistrySchema.parse`, which throws, and it silently drops blank values before you can inspect them. Instead:

1. `readFileSync(file, 'utf8')` inside a `try`/`catch`; a read failure becomes an error string.
2. `matter(content)` inside a `try`/`catch`; a parse failure becomes an error string mentioning malformed frontmatter and naming the file, mirroring `parseManifest`'s message style at `src/lib/pack.ts:30-36`.
3. `FolderSummaryRegistrySchema.safeParse(parsed.data)`. On `!result.success`, push a header line naming the file and then one `  - ${formatIssue(issue)}` line per `result.error.issues` entry — same two-level shape as the manifest failure at lines 69-72. Return early from the registry pass (do not proceed to key checks on unvalidated data).

**Key safety — the security-critical part.** `readFolderSummaries` validates *values* but never normalizes or validates *keys* on read (`src/lib/folder-summaries.ts:27-32`); only the write path rejects escapes, via the module-private `normalizeFolderSummaryKey` (`:76-84`). A hostile pack can therefore ship a key like `../../../evil`. Prefixing with the destination branch name does not reliably neutralize it, because `dest/../..` normalizes away.

For each key in `result.data.summaries`, reject it as an **error** when any of these hold, after converting to POSIX and applying `posix.normalize`:

- the normalized key starts with `../` or equals `..`
- the normalized key starts with `/` (absolute)
- the key is otherwise not a relative path confined under the knowledge tree

Mirror the conditions in `normalizeFolderSummaryKey` at `src/lib/folder-summaries.ts:80-82`. Note that `normalizeFolderSummaryKey` maps `.` and `/` to the empty string, and the empty string is the legitimate root-folder key — do **not** reject it. Each rejected key gets its own error line quoting the offending key verbatim.

Reject at validation time rather than letting `stampFolderSummary` throw during the merge: a mid-merge throw would leave the consumer's registry partially written. This ordering guarantee is what task 3 depends on.

**Missing-entry warnings.** Walk `knowledgeDir` recursively collecting every directory as a POSIX path relative to `knowledgeDir`, including `''` for the root. For each collected folder with no corresponding key in the registry, push a `warnings` entry naming the folder. These are warnings only — they must not set `ok` to `false`. The user explicitly chose warn-not-error here so that every already-published pack stays importable.

**Explicitly out of scope for this task.**

- Do not modify `FolderSummaryRegistrySchema` or `src/lib/folder-summaries.ts`.
- Do not change `NODE_SCHEMA_VERSION` or `PackManifestSchema.schema_version`. There is no separate pack-format version field, and bumping the node schema version would break every v3 knowledge base.
- Do not modify `src/commands/pack-import.ts` — surfacing these warnings on the successful-import path belongs to task 3.
- Do not write tests here; task 4 owns the test surface.

</details>
