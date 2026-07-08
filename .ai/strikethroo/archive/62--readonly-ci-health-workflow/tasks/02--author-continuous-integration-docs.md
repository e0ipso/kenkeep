---
id: 2
group: "ci-workflow"
dependencies: [1]
status: "completed"
created: 2026-07-07
skills:
  - jekyll-docs
  - technical-writing
---
# Author the continuous-integration docs page

## Objective

Create `docs/continuous-integration.md`: a Jekyll "Just the Docs" page that
documents the shipped `examples/kenkeep-check.yml` workflow, the failure-vs-warning
semantics of each kenkeep command, the shallow-checkout and harness-install
caveats, the drift-catcher's non-committing nature, how to read the PR comment,
and an explicit contrast with OpenWiki's unattended-agent-PR model citing
constitution §3 and `practice-dont-run-llm-pipelines-in-ci`.

## Skills Required

- `jekyll-docs` — "Just the Docs" frontmatter (`title`, `nav_order`, optional
  `parent`), `{% include callout.html %}` usage matching sibling pages, nav
  ordering.
- `technical-writing` — clear, scannable sections; accurate cross-references to
  the workflow file, constitution, and practice nodes.

## Acceptance Criteria

- [ ] `docs/continuous-integration.md` exists.
- [ ] The page has valid Jekyll frontmatter with `title` and a `nav_order` that
      places it after `installation` (nav_order 3) and before `troubleshooting`
      (nav_order 7) in the top-level sidebar — e.g. `4.5` (after `daily-use`).
- [ ] `rg -n 'nav_order|OpenWiki|constitution|practice-dont-run-llm-pipelines-in-ci|fetch-depth: 0|harness-install' docs/continuous-integration.md`
      matches each required token.
- [ ] The page contains all six sections from the plan's "Component: docs page"
      spec: Overview; Drop-in usage; What each step does; Caveats (shallow
      checkout, doctor harness-install warnings, drift-catcher non-committing);
      Reading the PR comment; Why not OpenWiki's unattended-agent-PR model.
- [ ] The OpenWiki-contrast section explicitly cites constitution §3 and
      `practice-dont-run-llm-pipelines-in-ci`, and names the three refusal
      reasons: (a) §3 mandates human-in-the-loop curation; (b) the practice
      node forbids `curate`/`bootstrap` in CI; (c) the KB is a team artifact,
      not an auto-generated cache.
- [ ] The page renders in the Jekyll build: `bundle exec jekyll build` (or
      `ls docs/_site/continuous-integration.html`) succeeds — paste the
      command output.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Frontmatter: `title: Continuous integration`, `nav_order: 4.5` (places it
  right after `daily-use.md` which is `nav_order: 4`, and before
  `knowledge-packs.md` at `5` — the natural "daily operations" neighbour per the
  plan). If `4.5` does not sort correctly in the installed theme, fall back to
  renumbering is NOT required; decimal `nav_order` is supported by "Just the
  Docs".
- Use `{% include callout.html variant="tip|warning" content="..." %}` for
  callouts, matching the style in `docs/daily-use.md`.
- Cross-link: link to `daily-use.md` (the curate loop) and to
  `internals/architecture.md` where useful; link to the shipped
  `examples/kenkeep-check.yml` via its repo-relative path.
- The six required sections (per plan "Component: docs page"):
  1. **Overview** — what the workflow does, that it is read-only and LLM-free,
     where to copy it (`examples/kenkeep-check.yml` →
     `.github/workflows/kenkeep-check.yml`).
  2. **Drop-in usage** — copy steps; ensure `fetch-depth: 0`; note the
     no-lockfile case (drop `cache: 'npm'`).
  3. **What each step does** — `lint` (errors fail), `doctor` (hard errors fail;
     warnings annotate, incl. harness-install/staleness/freshness), `freshness`
     (always advisory), drift-catcher (`index rebuild` + `git diff --exit-code`,
     read-only, non-committing). Enumerate exit semantics.
  4. **Caveats** — shallow checkout vs freshness; doctor harness-install
     warnings are expected in CI and not actionable unless the consumer repo
     actually has a harness installed; drift-catcher regenerates
     `ENTRY.md`/`GRAPH.md` only in the CI workspace, never commits, never writes
     to `nodes/`.
  5. **Reading the PR comment** — how to interpret the comment; remediation
     commands (`/kk-curate`, `kenkeep index rebuild`).
  6. **Why not OpenWiki's unattended-agent-PR model** — contrast with
     `examples/openwiki-update.yml` (cron + agent + `create-pull-request`); cite
     constitution §3 and `practice-dont-run-llm-pipelines-in-ci`; state the three
     refusal reasons (see Acceptance Criteria).
- Optional: add a one-line pointer from `README.md` to the new page IF (and only
  if) `README.md` already has a "Daily use" / "CI" section listing helpers. Do
  not invent a new section.

## Input Dependencies

- Task 1 (`examples/kenkeep-check.yml`) — the docs page must accurately describe
  the shipped workflow's actual steps, permissions, and comment marker. Verify
  the described step names, command invocations, and the
  `<!-- kenkeep-check -->` marker match the file Task 1 produced.

## Output Artifacts

- `docs/continuous-integration.md` — the user-facing docs page, wired into the
  Jekyll nav via `nav_order`.
- (Optional) a one-line pointer added to `README.md` if a suitable section
  exists.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Read these sibling pages first to match the house style:
- `docs/daily-use.md` — frontmatter shape, `{% include callout.html %}` usage,
  tone.
- `docs/installation.md` — for cross-linking from "Drop-in usage".
- `docs/internals/architecture.md` — for the Locking / constitution references.

The existing top-level `nav_order` values are: `index` (1), `how-it-works` (2),
`installation` (3), `daily-use` (4), `knowledge-packs` (5), `why-kenkeep` (6),
`troubleshooting` (7), `internals/index` (8). Placing the new page at
`nav_order: 4.5` slots it between `daily-use` and `knowledge-packs` — the plan
says "next to `daily-use.md`" and "after installation and before troubleshooting",
and 4.5 satisfies both. "Just the Docs" sorts decimal `nav_order` correctly.

For the OpenWiki-contrast section, the three refusal reasons (from the plan's
section 6 of the docs page) are:
1. Constitution §3 mandates human-in-the-loop curation (`/kk-curate` +
   `git commit`, never a write without acceptance).
2. `practice-dont-run-llm-pipelines-in-ci` forbids `curate`/`bootstrap` in CI.
3. The knowledge base is a team artifact, not an auto-generated cache.

Kenkeep's slice is the deterministic, read-only nudge; the LLM curates in a
human-supervised session, not in a CI runner. Contrast with OpenWiki's
`examples/openwiki-update.yml` which runs the agent on a cron and opens a docs
PR via `peter-evans/create-pull-request`.

To verify the Jekyll build: run `bundle exec jekyll build` from `/workspace`
(the `Gemfile` is at repo root, the docs config is `docs/_config.yml`). If Ruby
is unavailable in the environment, fall back to `ls docs/_site/continuous-integration.html`
after a build, or document the unavailability in the task report — but try the
build first. The acceptance criterion is that the page renders; capture the
command output as evidence.

Do NOT modify any file under `src/`. This plan is purely additive
(`examples/` + `docs/`). Do NOT add a practice node under
`.ai/kenkeep/nodes/` — the plan explicitly defers that to a separate `/kk-add`
action.

</details>
