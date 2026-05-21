---
id: 5
group: "docs-and-gitignore"
dependencies: [3, 4]
status: "pending"
created: 2026-05-21
skills:
  - documentation
---
# Update gitignore template and documentation for harness memory ingestion

## Objective
Ensure the new `memory-ledger.json` is gitignored on fresh and existing installs and document the new ingestion behaviour in `AGENTS.md`, `PRD.md`, and `README.md`.

## Skills Required
- documentation (project conventions, cross-linking practice nodes)

## Acceptance Criteria
- [ ] The gitignore template emitted by `init` covers `memory-ledger.json` (either implicitly via `.state/` or explicitly). If the current template ignores `.state/` as a directory, no change is required beyond verifying with a fresh `init` smoke test on a temp dir; otherwise add an explicit `memory-ledger.json` entry.
- [ ] `AGENTS.md` gains a brief subsection under "Capture and curation pipeline" (or the nearest existing section) explaining:
  - Memory files from the active harness are now ingested by `bootstrap-incremental` and `curate`.
  - The ledger lives at `.ai/knowledge-base/.state/memory-ledger.json`, is per-user, and is gitignored.
  - Secretlint redaction applies to memory content before any LLM call.
  - Cross-link the relevant practice nodes (existing `practice-curator-never-auto-resolves-contradictions`, `practice-capture-runs-secretlint-with-redaction`, `practice-dont-run-llm-pipelines-in-ci`).
- [ ] `PRD.md` — the section that enumerates source inputs to `bootstrap-incremental` and `curate` now lists harness memory alongside markdown and session logs. The constitution section is unchanged.
- [ ] `README.md` — add a one-line bullet in the feature list noting that the KB ingests harness-native memory files.
- [ ] `CLAUDE.md` is **not** modified (it already delegates to `AGENTS.md`).
- [ ] No new top-level files are created in this task. Practice-node creation for the new invariants is left to the normal `/kb-add` flow at merge time and is out of scope here.

## Technical Requirements
- Markdown only.
- Match the existing tone and section depth in each file. Do not introduce H1s; use the file's existing heading hierarchy.

## Input Dependencies
- Tasks 3 and 4 — the user-visible behaviour described in the docs must actually be implemented.

## Output Artifacts
- Updated `AGENTS.md`, `PRD.md`, `README.md`.
- Updated gitignore template (if change required).

## Implementation Notes

<details>
<summary>Concrete edits</summary>

1. **Gitignore template** — find it via:
   ```sh
   rg -l "\.state" --type=md --type=text -g 'templates*' -g '!node_modules' .
   ```
   The likely file is `src/templates-source/...` or `templates/.gitignore.tmpl`. If it already lists `/.state/` or `.state/`, smoke-test by running `npx . init` (or the project's equivalent) in `/tmp/kb-init-smoketest` and confirming `git status --ignored` lists `.ai/knowledge-base/.state/memory-ledger.json` as ignored. If not, append a line:
   ```
   .ai/knowledge-base/.state/memory-ledger.json
   ```

2. **`AGENTS.md`** — add (approximate placement under "Capture and curation pipeline"):
   ```md
   ### Harness memory ingestion

   `bootstrap-incremental` and `curate` ask the active harness for its
   auto-memory files via `HarnessAdapter.listMemoryFiles()` and treat the
   returned files as source inputs on equal footing with markdown docs
   (bootstrap) and pending session logs (curate). The pipeline tracks
   processed files in `.ai/knowledge-base/.state/memory-ledger.json`
   (per-user, gitignored) and skips files whose SHA-256 has not changed
   since the last successful run. All memory content passes through the
   existing [secretlint redaction pass][practice-capture-runs-secretlint-with-redaction]
   before reaching the LLM. CI is still barred from running either
   pipeline (see [practice-dont-run-llm-pipelines-in-ci]).
   ```
   Adjust link syntax to whatever AGENTS.md uses today.

3. **`PRD.md`** — locate the bullet list or table enumerating inputs to bootstrap-incremental / curate (search for "source inputs", "markdown", or "session logs"). Add "harness auto-memory files" to each. Leave the constitution section untouched.

4. **`README.md`** — add a bullet in the feature/highlights list along the lines of:
   > Ingests harness-native auto-memory files (Claude Code today; others as they ship the feature) into the knowledge base via the existing supervised review flow.

5. Verify via `git diff` that no unintended files moved.
</details>
