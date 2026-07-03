---
id: 10
group: "prompts-docs"
dependencies: [9]
status: "pending"
created: 2026-07-02
skills:
  - documentation
complexity_score: 4
complexity_notes: "Cross-cutting prose updates spanning internals docs, the AGENTS/README pointers, and content-update of the KB branch nodes that describe the old contract."
---
# Update documentation and KB nodes for the v3 OKF contract

## Objective
Rewrite the human-facing documentation to describe the v3 OKF bundle: the node
frontmatter contract and the generated-index metadata split in
`docs/internals/schemas.md`, the index/ENTRY/GRAPH generation model in
`docs/internals/architecture.md`, the OKF-bundle statement and `kk_` namespace
meaning in `README.md`/`AGENTS.md`, and content-update (via normal curation) the
`node-schema`, `index`, and `pack` branch nodes that currently describe the v2
contract.

## Skills Required
- **documentation** — write accurate, current internals and pointer docs.

## Acceptance Criteria
- [ ] `docs/internals/schemas.md` documents the v3 node frontmatter contract and the generated-index metadata split (reserved files frontmatter-free except root `okf_version`; folder summaries in the sidecar).
- [ ] `docs/internals/architecture.md` explains OKF reserved indexes and that ENTRY/GRAPH remain kenkeep-owned generated artifacts.
- [ ] `README.md` and `AGENTS.md` state the KB is an OKF v0.1 bundle and explain the `kk_` extension namespace; the AGENTS.md pointer text is refreshed only if it names v2 specifics.
- [ ] The `node-schema`, `index`, and `pack` branch nodes in `.ai/kenkeep/` are content-updated to describe v3 (via the normal curation workflow); the tooling-evaluation decision is captured as a node when task 11 completes.
- [ ] Verification: `grep -rIn -e '\bschema_version: 2\b' -e '\bkind:' -e '\bsummary:' docs README.md AGENTS.md` returns no stale v2 node-contract references; a reviewer confirms the schemas.md contract matches `NodeFrontmatterSchema`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `docs/internals/schemas.md`, `docs/internals/architecture.md`,
  `README.md`, `AGENTS.md`; KB branch nodes under `.ai/kenkeep/nodes/`.
- KB node updates go through curation (edit node bodies), not raw frontmatter
  hacking.

## Input Dependencies
- Task 9: the migrated v3 bundle whose behavior the docs describe.

## Output Artifacts
- Current documentation and KB nodes describing the v3 contract.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Rewrite `docs/internals/schemas.md` to enumerate the v3 fields exactly as in
   `NodeFrontmatterSchema` (task 1), including the ≤140-char `description` and the
   `kk_` namespace, and document that reserved index files are frontmatter-free
   except the root `okf_version`, with folder summaries in the sidecar.
2. Update `docs/internals/architecture.md` for the index/ENTRY/GRAPH model.
3. Update `README.md`/`AGENTS.md`: state the OKF v0.1 bundle and `kk_` meaning;
   only touch the AGENTS.md pointer text if it names v2 specifics.
4. Content-update the `node-schema`, `index`, and `pack` branch nodes to v3 via
   the normal curation edit path (do not bypass write validation).
5. Run the grep check to confirm no stale v2 node-contract references remain in
   docs/README/AGENTS.
</details>
