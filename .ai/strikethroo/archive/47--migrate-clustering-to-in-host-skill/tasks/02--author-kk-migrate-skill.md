---
id: 2
group: "in-host-skill"
dependencies: []
status: "completed"
created: 2026-06-09
skills:
  - skill-authoring
---
# Author the kk-migrate in-host skill (SKILL.md)

## Objective
Create `src/templates-source/skills/kk-migrate/SKILL.md`: the in-host skill the
user invokes to perform the v1->v2 clustering directly in their current agent
session, with no subprocess and no `<harness> -p` spawn. The skill carries the
clustering instructions lifted from the current `CLUSTER_INSTRUCTIONS` constant
(preserve every id; author a one-line summary per created folder), embeds the
standard harness-detection block (needed for the final `index rebuild`), and
orchestrates the flow: confirm the KB is at v1 and obtain the flat-leaf
inventory from the deterministic primitive's inventory mode; cluster in-session
and surface the proposed grouping to the user for review; hand the
placement-and-folders JSON to the primitive's apply mode; trigger
`index rebuild`; and instruct the user to review with `git diff` and accept by
commit / reject by `git restore`. The skill performs no atomic file writes
itself.

## Skills Required
- `skill-authoring`: writing a kenkeep SKILL.md that conforms to the existing
  skill conventions (frontmatter, version comment, the in-host "you are the LLM"
  framing, the harness-detection heredoc, and CLI-primitive delegation).

## Acceptance Criteria
- [ ] `src/templates-source/skills/kk-migrate/SKILL.md` exists with valid
      frontmatter (`name: kk-migrate`, a `description` matching the
      `kk-curate`/`kk-add` style) and a `<!-- Version: 1 -->` marker.
- [ ] It states plainly that the agent in session is the one doing the
      clustering — no sub-agent, no runner, no `-p` spawn (mirroring kk-curate's
      "**you** are the LLM doing the curation" framing).
- [ ] It embeds the harness-detection block **byte-for-byte identical** to the
      one in `src/templates-source/skills/kk-curate/SKILL.md` (the
      `/tmp/kk-detect-harness.mjs` heredoc), because `index rebuild` requires
      `$HARNESS`.
- [ ] It carries the clustering instructions equivalent to the current
      `CLUSTER_INSTRUCTIONS` constant: group related leaves into a small set of
      lowercase, dash-separated (optionally nested) topical folders; keep
      cross-referencing nodes near each other; preserve every id exactly (never
      invent/rename/drop); and author one `summary` per created folder as a
      fragment completing "for more information on <summary>" (lowercase start,
      no trailing period, <= ~140 chars).
- [ ] The flow obtains the inventory by calling the deterministic primitive's
      inventory mode, clusters in-session, surfaces the grouping for user review,
      then pipes the placement-and-folders JSON into the primitive's apply mode,
      then runs `npx kenkeep index rebuild --harness "$HARNESS"`.
- [ ] The placement-and-folders JSON the skill produces matches the exact shape
      the apply mode parses (Task 1):
      `{"placements":[{"id","targetFolder"}],"folders":[{"folder","summary"}]}`.
- [ ] It ends by instructing the user to review with `git diff` and accept by
      `git commit` / reject by `git restore`; the skill never invokes git and
      never writes node files directly.
- [ ] `prettier --check .` passes (markdown is formatted).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File location: `src/templates-source/skills/kk-migrate/SKILL.md`. The build
  (`scripts/build-templates.mjs`) copies `src/templates-source/` wholesale into
  `templates/`, and `installSharedSkills` (`src/lib/install-skills.ts`) copies
  the whole `templates/skills/` tree into each harness's skills dir — so placing
  the file here is sufficient for it to ship and install; there is no per-skill
  registration list to edit.
- The harness-detection heredoc must be copied exactly from
  `kk-curate/SKILL.md` so it stays consistent with `src/harnesses/detect.ts`
  (the `lint-detect-harness.mjs` check validates the kk-curate copy; keep this
  one identical to avoid drift).
- The exact primitive command names come from Task 1; reference them by their
  registered names. If Task 1 is not yet merged when authoring, use the names as
  finalized in Task 1's CLI registration.

## Input Dependencies
- The placement-and-folders JSON contract and the inventory/apply command names
  defined by Task 1 (the deterministic primitive). These can be taken from
  Task 1's spec; physical completion of Task 1 is not required to author the
  prose, but the command names and JSON shape must agree with it.

## Output Artifacts
- `src/templates-source/skills/kk-migrate/SKILL.md` — the in-host migration
  skill, itself the user-facing documentation of the migration procedure. Task 4
  (discoverability) points users at this skill; Task 5 asserts it is materialized
  on init/upgrade.

## Implementation Notes
This is documentation/prose work, not TypeScript. Model the structure on
`src/templates-source/skills/kk-curate/SKILL.md`: frontmatter + version comment,
a one-paragraph "you are the X" intro, a "Resolve the active harness" section
with the heredoc, then numbered steps, then a Constraints section.

<details>
<summary>Detailed authoring guidance</summary>

**Source the clustering instructions** from `src/commands/migrate.ts` lines
201-212 (`CLUSTER_INSTRUCTIONS`). Reword them as direct second-person
instructions to the in-session agent rather than a prompt string, but preserve
every requirement: small set of topical folders; lowercase dash-separated,
may nest with `/`; keep mutually-referencing nodes close; preserve every id
exactly (never invent, rename, or drop an id); one `summary` per folder as a
noun-phrase/fragment completing "for more information on <summary>", lowercase
start, no trailing period, <= ~140 chars.

**Copy the harness heredoc verbatim** from `kk-curate/SKILL.md` lines 16-72
(the `if [ ! -f /tmp/kk-detect-harness.mjs ]; then cat << 'EOF' > … EOF fi` block
plus the `HARNESS=$(node /tmp/kk-detect-harness.mjs --hint <hint>)` line). Add
the same note that `$HARNESS` is consumed by `index rebuild`.

**Suggested step structure:**
1. *Resolve the active harness* — the heredoc block.
2. *Confirm migration is due and get the inventory* — run the primitive's
   inventory mode; if it reports "nothing to do", stop with that message; else
   capture the emitted flat-leaves JSON.
3. *Cluster in-session* — apply the clustering instructions to the leaves; build
   the `{"placements":[…],"folders":[…]}` document. Surface the proposed grouping
   to the user (folder tree + which ids land where) for review before any write.
4. *Apply deterministically* — pipe the JSON document into the primitive's apply
   mode (`echo '<json>' | npx kenkeep@latest <primitive> <apply-sub>` or via
   `--input <tmpfile>`). The primitive validates ids against the real leaves and
   aborts before any write on a bad plan; do not relocate files or stamp
   summaries yourself.
5. *Rebuild indices* — `npx kenkeep index rebuild --harness "$HARNESS"`.
6. *Hand off* — tell the user to review with `git diff`, accept by `git commit`,
   reject by `git restore`. State explicitly that no git command was run.

**Constraints section** should restate: the skill is in-host (no sub-agent, no
`-p`); it never writes node files directly (the primitive does); it never
invokes git; ids and edges are preserved by the primitive's validation; a folder
with no authored summary renders the Title-cased fallback (warn, never block).

**Do not** include any `claude -p` / `execFileSync` / sub-agent dispatch. The
whole point of this plan is that the clustering runs in the current session.
</details>
