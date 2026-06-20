---
id: 1
group: "usage-extraction"
dependencies: []
status: "pending"
created: 2026-06-20
skills:
  - typescript
  - parsing
  - usage-tracking
complexity_score: 6
complexity_notes: "Adds shared command parsing plus an explicit usage-layer resolution contract so relative KB candidates do not depend on hook cwd."
---
# Add Command Path Candidate Extraction

## Objective
Add a shared, conservative helper in `src/harnesses/read-extract.ts` that extracts markdown path candidates from shell/search command strings while preserving order and duplicates, and define the usage-layer path resolution needed for those candidates to classify deterministically.

## Skills Required
Requires `typescript`, `parsing`, and `usage-tracking` skills to add command-string parsing without introducing brittle shell execution assumptions or cwd-dependent usage classification.

## Acceptance Criteria
- [ ] A shared helper extracts candidate markdown paths from command strings containing absolute paths, repo-relative `.ai/kenkeep/nodes/...` paths, and `nodes/...` paths.
- [ ] The helper strips common shell quotes and trailing command separators where safe, but does not execute commands, expand globs, parse shell output, or infer paths from assistant prose.
- [ ] The helper preserves input order and duplicate occurrences.
- [ ] Malformed, empty, or non-string command inputs produce no entries and never throw.
- [ ] `src/lib/usage.ts` or the capture-to-usage boundary has an explicit, tested resolution contract for `.ai/kenkeep/nodes/...` and `nodes/...` candidates, rather than relying on `process.cwd`.
- [ ] Existing absolute path classification and dedicated read-tool extraction behavior remain unchanged.
- [ ] `UsageRecordSchema` and persisted `usage.jsonl` fields are unchanged.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Implement the helper in `src/harnesses/read-extract.ts`, near the existing shared extraction helpers. It should collect candidates only from command text, not arbitrary assistant prose, and should leave final safety filtering to the usage layer.

Update `src/lib/usage.ts` only as narrowly as needed to make supported relative knowledge-base candidate forms deterministic:

- absolute paths: existing behavior;
- `.ai/kenkeep/nodes/.../*.md`: resolve from the repository root implied by `kkDir`;
- `nodes/.../*.md`: resolve from `kkDir`;
- other relative paths: ignore unless existing absolute/cwd behavior already resolves them under `nodesDir`.

## Input Dependencies
No task dependencies. Use the current `src/harnesses/read-extract.ts` extractors and `src/lib/usage.ts` classification behavior as the baseline contract.

## Output Artifacts
- Shared command-string candidate extraction helper in `src/harnesses/read-extract.ts`.
- Narrow usage path-resolution change in `src/lib/usage.ts` if needed.
- Focused helper and classification tests in `tests/harnesses/read-extract.test.ts` and `tests/lib/usage.test.ts`.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Keep the helper deliberately simple. It should scan command strings for markdown path-like tokens and return raw candidate strings; it should not stat files, resolve working directories, parse every shell grammar edge case, or decide whether a path is a knowledge-base document.

Candidate forms to support:

- Absolute markdown paths that include `.ai/kenkeep/nodes/`.
- Repo-relative `.ai/kenkeep/nodes/.../*.md` paths.
- `nodes/.../*.md` paths, because some capture contexts may pass node-tree-relative command arguments through for downstream classification.

Handle common command forms such as `cat`, `sed -n '1,40p'`, `head`, `tail`, `rg`, and `grep` only as command text sources. Do not infer reads from arbitrary natural-language text.

Keep the parser token-oriented rather than shell-complete. Handling quoted path tokens is useful; evaluating redirects, command substitutions, glob expansion, or command output is out of scope for this task.

Preserve order and duplicates exactly as they appear in the command text. This matters because `reconcileUsage` appends one line per observed read occurrence and reconciles monotonically by session.

Avoid changing the `UsageRecordSchema`. Broad extraction is acceptable only because usage classification remains the authoritative filter for markdown files under `.ai/kenkeep/nodes/`.
</details>
