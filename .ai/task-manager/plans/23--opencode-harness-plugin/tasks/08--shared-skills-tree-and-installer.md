---
id: 8
group: "skills-consolidation"
dependencies: [3, 4]
status: "completed"
created: 2026-05-15
skills:
  - typescript
  - node
---

# Consolidate per-harness SKILL.md to a single shared tree resolved at runtime

## Objective

Replace three per-harness SKILL.md trees with one. Move sources to `src/templates-source/skills/kb-{add,bootstrap,curate}/SKILL.md`. Rewrite each body to materialize `/tmp/kb-detect-harness.mjs` lazily from a heredoc, then run it to resolve the active harness, then invoke `npx @e0ipso/ai-knowledge-base ... --harness "$HARNESS"`. Update the installer so every configured harness's `paths.skillsDir` receives the same shared bytes during `init` and `init --upgrade`.

Delete `src/templates-source/claude/skills/`, `src/templates-source/codex/skills/`, and (do not create) `src/templates-source/opencode/skills/`.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `src/templates-source/skills/kb-add/SKILL.md`, `src/templates-source/skills/kb-bootstrap/SKILL.md`, `src/templates-source/skills/kb-curate/SKILL.md` exist with the detect-harness recipe in their bodies
- [ ] `src/templates-source/claude/skills/` and `src/templates-source/codex/skills/` directories are deleted
- [ ] Frontmatter on each shared SKILL.md contains only fields every supported harness accepts: `name`, `description`. No `allowed-tools`
- [ ] Each SKILL.md body contains a self-contained heredoc that lazy-writes `/tmp/kb-detect-harness.mjs` on first invocation. The heredoc is byte-identical across the three files (verified by a `diff` step)
- [ ] The detect-harness script implements: (1) hint validation against the hardcoded id list `['claude', 'codex', 'opencode']` and wins when valid; (2) env detection in registry order, currently `CLAUDECODE === '1'` → `claude`; (3) `cliDefaultHarness` from `<repo-root>/.ai/knowledge-base/config.yaml`; (4) non-zero exit with a stderr message directing the user to set `--hint` or `cliDefaultHarness`
- [ ] The detect script walks up from `process.cwd()` looking for `.ai/knowledge-base/` to locate the repo root
- [ ] Script prints exactly the resolved id to stdout with no extra newline noise
- [ ] Total script body well under 100 lines
- [ ] Installer logic (shared helper called by every adapter's `install()`/`upgrade()`) copies `src/templates-source/skills/` to `paths.skillsDir` for the active harness. Claude/Codex/OpenCode adapters all delegate skill installation to this helper instead of copying their own per-harness skill source
- [ ] After running `init --harnesses claude,codex,opencode`, the byte content of `.claude/skills/kb-curate/SKILL.md`, `.agents/skills/kb-curate/SKILL.md`, and `.opencode/skills/kb-curate/SKILL.md` is identical (verified via sha256 in an integration test)
- [ ] Existing Claude and Codex adapters' `install()` functions no longer reference per-harness skill source paths
- [ ] `npm run build` succeeds; `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/templates-source/skills/kb-{add,bootstrap,curate}/SKILL.md`
- Shared installer helper at `src/lib/install-skills.ts` (or similar) consumed by all three adapter installs
- Touches `src/harnesses/claude/install.ts`, `src/harnesses/codex/install.ts`, `src/harnesses/opencode/install.ts`
- Detect script body must mirror the priority chain implemented in `resolveWithHint` (Task 3) so the CI lint (Task 9) passes

## Input Dependencies

- Task 3 (`resolveWithHint` defines the canonical priority chain the heredoc mirrors)
- Task 4 (OpenCode adapter exists, so the shared installer can be wired into all three adapters)

## Output Artifacts

- Shared skill source tree
- Shared installer helper
- `/tmp/kb-detect-harness.mjs` recipe baked into every shared SKILL.md

## Implementation Notes

<details>
<summary>Guidance</summary>

- The heredoc + invocation pattern in each SKILL.md body:
  ```markdown
  1. Materialize the detect-harness helper (skip if it already exists):

     ```bash
     if [ ! -f /tmp/kb-detect-harness.mjs ]; then
       cat << 'EOF' > /tmp/kb-detect-harness.mjs
       // [script body, single source of truth across kb-add, kb-bootstrap, kb-curate]
       EOF
     fi
     ```

  2. Resolve the active harness:

     ```bash
     HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <claude|codex|opencode>)
     ```

  3. Invoke the CLI with `--harness "$HARNESS"`.
  ```
- The LLM authoring the skill body must substitute its own best-guess id for `<claude|codex|opencode>` at runtime. Document this expectation in the prose preceding the heredoc.
- The Claude `allowed-tools` frontmatter field is gone. Permission friction is acceptable per the plan; document in Task 10's installation.md update. The shared skill copy is the trade-off for eliminating duplication.
- For Codex, the skill copies into `.agents/skills/` (matching the existing Codex paths). For OpenCode, `.opencode/skills/`. OpenCode also resolves `.agents/skills/` as a fallback per its docs, but we install into its primary location.
- Per `feedback_no_backwards_compat`: do not leave behind a redirect or compatibility shim from the old per-harness skill paths. Delete them outright. Existing users on `init --upgrade` get the new shared bytes at the same install location.
- The detect script must mirror `resolveWithHint` from Task 3 exactly (including hint-wins-when-explicit ordering). A drift between the two is caught by Task 9's CI lint.

</details>
