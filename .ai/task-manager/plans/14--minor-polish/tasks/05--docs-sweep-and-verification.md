---
id: 5
group: "minor-polish"
dependencies: [1, 2, 3, 4]
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - technical-writing
---
# Docs sweep + verification pass

## Objective
Land the cross-cutting documentation updates that go with the four removals (CHANGELOG entry, AGENTS.md / CLAUDE.md / README, sample `config.yaml`, KB nodes) and execute the verification pass defined in the plan's **Success Criteria** and **Self Validation** sections.

## Skills Required
- `technical-writing`: CHANGELOG entry; README / AGENTS.md / CLAUDE.md sweep for `lockTtlMs`, `--verbose` on `curate`, heartbeat output, and the curator's "current KB index" input; KB node sweep.
- `typescript`: optional smoke build (`npm run build`) and reading the generated payload during the payload-shape sanity check.

## Acceptance Criteria
- [ ] **CHANGELOG.md** has an entry summarizing the four removals. It notes: prior `state.json` files load without migration and the obsolete `lock` field is silently dropped on the next state write; the `--verbose` flag on `curate` is removed (users tail the log file directly); the curator prompt is now Version 5.
- [ ] **AGENTS.md**, **CLAUDE.md**, and **README.md** at the repo root no longer reference `lockTtlMs`, `--verbose` (in the context of `curate`), the per-batch heartbeat output, or the curator's "current KB index" / `index_summary` input. Sample `config.yaml` snippets no longer list `lockTtlMs`.
- [ ] `src/templates-source/knowledge-base/config.yaml` (or whichever file ships the default `config.yaml`) no longer carries `lockTtlMs`.
- [ ] No KB node under `.ai/knowledge-base/nodes/` mentions `lockTtlMs`, the hand-rolled lock, the heartbeat printer, the `--verbose` flag for `curate`, or `index_summary` as a current part of the system. Stale nodes are updated or deleted.
- [ ] **Static sweeps return zero hits**:
  - `rg -n 'FailureReportSchema|acquireLock|releaseLock|DEFAULT_LOCK_TTL_MS|LockOptions|CURATOR_LOCK_NAME|BOOTSTRAP_LOCK_NAME|PROPOSAL_LOCK_NAME|StateLockSchema|lockTtlMs|HEARTBEAT_MS|heartbeats|makeVerbosePrinter|AssistantContentBlock|AssistantMessage|index_summary' src/ tests/ templates/ src/templates-source/`
  - `rg -n 'lockTtlMs|lock_ttl_ms' .` returns no hits outside `archive/`, `CHANGELOG.md`, or this plan directory.
- [ ] `diff src/templates-source/prompts/curator.md templates/prompts/curator.md` returns zero differences; `grep -n 'Version:' src/templates-source/prompts/curator.md` returns `Version: 5`.
- [ ] `node -e "console.log(Object.keys(require('./package.json').dependencies))"` includes `proper-lockfile`.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` exits 0; `git diff main -- tests/ | grep -E '^\+.*\.(skip|todo)'` returns nothing (no new skipped or todo'd tests introduced by this branch).
- [ ] **CLI smoke**, in a fresh scratch directory (e.g. `mktemp -d`):
  - `ai-knowledge-base init --assistants claude` exits 0; if a `state.json` is created, it has no `lock` field.
  - Hand-craft a `state.json` containing an obsolete `lock: { name: "curator", pid: 99999, acquired_at: "2020-01-01T00:00:00Z", ttl_ms: 1800000 }` and run `ai-knowledge-base curate`; the run succeeds without errors and the obsolete field is silently dropped on the next state write.
  - Two concurrent `ai-knowledge-base curate` invocations against the same KB: the second exits with the existing locked-result message and exit code 0.
  - The first `curate` run prints exactly `  curator log: <path>` and `  follow live: tail -f <path>` under the "Curating pending session logs…" line; no `still running (Xs)…` output appears anywhere.
  - `ai-knowledge-base curate --help` lists no `--verbose` / `-v` option.
- [ ] Payload-shape sanity (one-off): temporarily add `console.log(payload)` inside `buildBatchPayload`, run `curate` against the scratch fixture, confirm the printed payload has no `index_summary` key, then remove the `console.log` and re-run the tests.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The verification pass mirrors the plan's **Self Validation** and **Success Criteria** sections. Use those as the binding checklist if any acceptance criterion above is ambiguous.
- Documentation sweeps must update *current* phrasing only; do not add retrospective framing (no "previously" / "earlier versions" outside the CHANGELOG). The standing memory `[No retrospective framing in docs or comments]` and KB practice `practice-no-schema-migrators` both apply.
- The CHANGELOG is the only place where retrospective framing belongs.
- The "obsolete `lock` field silently dropped on next state write" sentence is informational, not a migration. No migration code is added.

## Input Dependencies
- Tasks 1, 2, 3, and 4 must all be complete; this task only verifies and documents the resulting state.

## Output Artifacts
- Edited `CHANGELOG.md`.
- Edited root docs (`AGENTS.md`, `CLAUDE.md`, `README.md` as applicable).
- Edited sample `config.yaml` (template or shipped default).
- Updated or deleted KB nodes under `.ai/knowledge-base/nodes/`.
- Recorded outputs of the smoke run (in the task's PR description or implementation notes for human review).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Sweep for documentation that mentions the now-removed surfaces:
   ```bash
   rg -n 'lockTtlMs|lock_ttl_ms|--verbose|heartbeat|still running|index_summary|current KB index|FailureReportSchema|StateLockSchema|acquireLock|releaseLock|CURATOR_LOCK_NAME|BOOTSTRAP_LOCK_NAME|PROPOSAL_LOCK_NAME' \
     AGENTS.md CLAUDE.md README.md docs/ .ai/knowledge-base/nodes/ src/templates-source/knowledge-base/
   ```
   For each hit:
   - If it describes current behaviour → rewrite to match the new state.
   - If it documents a now-removed surface → delete the bullet/section.
   - If the file is a KB node whose entire point is the removed surface → delete the node, and remove its line from any `INDEX.md` / `MEMORY.md`-style index.
2. Update `src/templates-source/knowledge-base/config.yaml` (or the actual default config sample's path) to drop the `lockTtlMs:` line if present.
3. Write the `CHANGELOG.md` entry. Use the project's existing entry format (look at recent commits / entries for style). Keep it concise:
   - `FailureReportSchema` removed; `FailureReport` is now a plain TS interface.
   - Hand-rolled state-file lock removed; `proper-lockfile` now locks `state.json` directly. The `lockTtlMs` setting is removed. Prior `state.json` files load without migration; the obsolete `lock` field is silently dropped on next state write.
   - `--verbose` flag removed from `ai-knowledge-base curate`; the run now prints a one-line `tail -f` hint pointing at the log file.
   - `index_summary` removed from the curator batch payload; the curator prompt is now Version 5 and instructs the curator to `drop` candidates that overlap an existing node not listed in the batch.
4. Run the **static sweeps** in the acceptance criteria. Each one must return zero hits in the listed scopes. Fix anything that doesn't.
5. Run the **build and tests**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   npm test
   ```
   All must exit 0. Confirm no new `it.skip` / `describe.skip` was introduced (`git diff main -- tests/ | grep -E '^\+.*\.(skip|todo)'` returns nothing).
6. Run the **CLI smoke** in a scratch directory:
   ```bash
   tmpdir=$(mktemp -d)
   cd "$tmpdir"
   node /workspace/dist/cli.js init --assistants claude
   # ...follow the acceptance-criteria steps
   ```
   Record observed output (truncated as needed) into the PR description.
7. Payload-shape sanity check:
   - Add `console.log('PAYLOAD', JSON.stringify(payload, null, 2));` inside `buildBatchPayload`.
   - Run `curate` against the scratch fixture; capture the printed payload.
   - Confirm there is no `index_summary` key.
   - **Remove the `console.log`** and re-run `npm test` to confirm green.
8. Verify both copies of the curator prompt:
   ```bash
   diff src/templates-source/prompts/curator.md templates/prompts/curator.md   # expect empty
   grep -n 'Version:' src/templates-source/prompts/curator.md                  # expect Version: 5
   ```
9. Confirm `proper-lockfile` in `package.json`:
   ```bash
   node -e "console.log(Object.keys(require('./package.json').dependencies))"
   ```
   Output must include `proper-lockfile`.

</details>
