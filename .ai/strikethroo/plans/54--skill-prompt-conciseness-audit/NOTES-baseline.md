# Task 001 — Baseline scope, contract checklist, helper packaging decision

## Source-of-truth map

- **Canonical kk skills:** `src/templates-source/skills/kk-{add,bootstrap,curate,migrate,session-extract}/SKILL.md`.
- **Canonical prompt:** `src/templates-source/prompts/proposal-extract.md`.
- **Generated (never hand-edit):** `templates/` (built by `scripts/build-templates.mjs` via `npm run build:templates`).
- **kenkeep skeleton source:** `src/templates-source/kenkeep/` → copied to `.ai/kenkeep/` by `init` (`copyTree(templates/kenkeep, paths.kkDir)`).
- **Installed kk skill mirrors (this checkout):**
  - `.claude/skills/kk-{add,bootstrap,curate,migrate}` (no `kk-session-extract`)
  - `.agents/skills/kk-{add,bootstrap,curate,migrate}` (no `kk-session-extract`)
  - `.cursor/skills/kk-{add,bootstrap,curate}` (no `kk-migrate`, no `kk-session-extract`; 1 line shorter — pre-existing drift)
  - `.opencode/skills/kk-{add,bootstrap,curate,migrate}` (no `kk-session-extract`)
  - `.github/skills` **absent** in this checkout (Copilot install path must still work from package).
- **Installed st skills:** `.claude/skills/st-*` and `.agents/skills/st-*` (identical pairs). st skills have no template-source; they are managed copies.
- Installed copies are refreshed on `init`/upgrade by `installSharedSkills` (`cpSync(force:true)`, copy-not-delete).

## Baseline line counts (pre-edit)

| File | lines |
|---|---|
| src kk-add | 128 |
| src kk-bootstrap | 282 |
| src kk-curate | 560 |
| src kk-migrate | 182 |
| src kk-session-extract | 167 |
| src proposal-extract.md | 295 |
| st-create-plan | 120 |
| st-execute-blueprint | 147 |
| st-execute-task | 195 |
| st-full-workflow | 413 |
| st-generate-tasks | 244 |
| st-refine-plan | 205 |

## Behavior contract checklist (must survive)

- **CLI primitives:** `session-log update-proposals` / `stage-live`, `curate-dedup`, `node write`, `index rebuild`, `finddocs`, `rebalance trigger`, `rebalance move`, `migrate status`, `place inventory`, `place apply`.
- **Flags:** `node write`: `--title --summary --tags --relates-to --depends-on --confidence --folder --source-doc --source-hash`; `curate-dedup`: `--input --output --run-id --session-id`; `index rebuild --harness`; `finddocs --from --with-hashes`; `session-log update-proposals <path> --status done|failed --error`; `stage-live --session-id|--generate-session-id`; `place apply --input`; `rebalance move --input`.
- **Curator action schema (`src/lib/schemas.ts`, the contract):** action `add|modify|contradict|drop`; `candidate_origin`, `target_node_id` (nullable), `proposed_node` (nullable), `rationale`, optional `home_folder`. `proposed_node` keys: `title|kind|tags|summary|body|confidence|relates_to` + optional `depends_on`. No `suggested_resolution`. `.strict()` rejects extra keys.
- **Field semantics per action** (target_node_id/proposed_node/home_folder presence table) — keep.
- **`home_folder`** root fallback (absent/null/empty ⇒ `nodes/` root) and `--folder` only for `add` with non-empty home_folder; `modify` never relocates and verifies target exists on disk.
- **Conflict resolution:** files under `.ai/kenkeep/conflicts/<id>.md`; reply tokens `y/n/s/k` (+ long forms/empty=default); default computation (`lines_changed<5 & high ⇒ y`; `ratio>0.5 ⇒ n`; else `s`; null target ⇒ s); outcome map per token.
- **Rebalance:** deterministic trigger `{"actions":[]}` skip path; operation classes `split-folder|split-leaf|merge|create-branch`; summary-fragment authoring per new folder; `rebalance move` is the only mutator; never git.
- **Proposal extract output schema:** one JSON object `{practice:[],map:[]}`; entries `{kind,tags,title,summary,body,confidence}`; reject extra keys (no legacy `supports_existing_node`/`contradicts_existing_node`).
- **Curate Step 0 / Step 1 enumeration**, batch ≤10, dedup-once invariant.
- **st structured summary blocks:** `Plan Summary` (st-create-plan), `Task Generation Summary` (st-generate-tasks), `Execution Summary` (st-execute-blueprint). st-execute-task blocking status checks (completed/in-progress/needs-clarification/missing/deps-incomplete). Helper script invocations, hook references, template references.

## Helper packaging decision

**Chosen location:** `.ai/kenkeep/scripts/kk-detect-harness.mjs` (the work-order's requested path).

Rationale: kk skills already run with cwd = repo root (every command uses repo-relative `.ai/kenkeep/...` paths), so `.ai/kenkeep/scripts/kk-detect-harness.mjs` is a stable cwd-relative reference. The skills-tree alternative has no cwd-stable path (each harness installs skills to a different dir).

Packaging mitigations (required by plan success criteria 2–4):
1. Add canonical source `src/templates-source/kenkeep/scripts/kk-detect-harness.mjs` → ships to `templates/kenkeep/scripts/` via build → `init` copies it to `.ai/kenkeep/scripts/` (skeleton copy already runs on first install).
2. Add this repo's dogfood copy at `.ai/kenkeep/scripts/kk-detect-harness.mjs`.
3. `init --upgrade` does NOT re-copy the skeleton — add an `ensureKkScripts` step that copies `templates/kenkeep/scripts/*` into `.ai/kenkeep/scripts/` for missing files only (never overwrites user-owned files).
4. Rewrite `scripts/lint-detect-harness.mjs` to read the extracted helper source (REGISTERED + ENV_DETECTORS) and diff it against `src/harnesses/registry.ts` + adapter `detectFromEnv` bodies, instead of parsing the removed heredocs.

`.ai/kenkeep/scripts/` is not gitignored (only `_sessions/`, `_logs/`, `.state/*`), so the helper is a committed team artifact.

## Scope note (noteworthy)

The work order/plan say "four kk skills" embed the detection heredoc, but **five** do: `kk-session-extract` carries the identical heredoc. Removing the heredoc from only four leaves a 5th duplicated copy — the exact duplication the extraction targets, and dead/divergent content the POST_EXECUTION no-tech-debt gate forbids. Decision: apply the **detector-extraction-only** change to `kk-session-extract` too (pure mechanical reference swap, no behavior change, no version bump — same treatment as `kk-migrate`). All other conciseness edits remain scoped to the named files.

## Versioning / changelog obligations

- Skill `<!-- Version: N -->`: kk-curate=3, kk-add=3, kk-bootstrap=1, kk-migrate=2, kk-session-extract=1.
  - Behavior-affecting prose edits (kk-curate condensation, kk-add wording, kk-bootstrap delegation) ⇒ bump those skills' Version comments.
  - Pure reference-only detector swap (kk-migrate, kk-session-extract) ⇒ no bump (document why).
- `proposal-extract.md` top-of-file `Version: 1` ⇒ bump to 2 in **both** canonical and `.ai/kenkeep/.config/prompts/` copy (trim can affect model output); add `CHANGELOG.md` Unreleased entry.

## Tests that encode the old `/tmp/...` mechanism (must update in task 2)

- `tests/init.test.ts` "installs the shared skill bytes identically…" asserts `claudeSkill` contains `/tmp/kk-detect-harness.mjs` → change to the new `.ai/kenkeep/scripts/kk-detect-harness.mjs` reference; add an assertion that `.ai/kenkeep/scripts/kk-detect-harness.mjs` is created.
- `tests/upgrade.test.ts` "overwrites a stale kk-curate skill…" asserts both kk-curate and kk-migrate contain `/tmp/kk-detect-harness.mjs` → update to the new reference; add an upgrade test that a missing `.ai/kenkeep/scripts/kk-detect-harness.mjs` is re-created.
