---
schema_version: 2
nodes_hash: 'sha256:4ca63ce73ab3fac036c7dbe45d4f57d5a6190fc5bf373894ffe48dc1616818b1'
node_count: 8
---
# kenkeep Index: curation

_8 node(s) in this folder • ~2778 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **Curator never auto-resolves contradictions** [`curation/practice-curator-never-auto-resolves-contradictions.md`] Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate. #curator #conflicts #human-in-the-loop
- **Curate CLI conflict output names the three resolution outcomes** [`curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md`] When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate. #kenkeep #kk-curate #conflicts #cli #ux
- **Curator drops non-productive and change-oriented candidates** [`curation/practice-curator-drops-non-productive-candidates.md`] Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak. #curator #prompts #calibration #anti-pattern

## Components (what exists)
- **curate (CLI command + /kk-curate skill)** [`curation/map-curate-command.md`] Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent. #cli #curate #skill
- **Conflict files (conflicts/<run-id>-<n>.md)** [`curation/map-conflict-files.md`] Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit. #conflicts #curator #schema
- **Curator action (add / modify / contradict / drop)** [`curation/map-curator-action.md`] Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/. #schema #curator #action
- **Proposal candidate schema** [`curation/map-proposal-candidate-schema.md`] Shape emitted by proposal-extract per practice/map candidate. supports_existing_node / contradicts_existing_node are the curator's join keys. #schema #proposal #candidate
- **curate CLI conflict-resolution output message** [`curation/map-curate-cli-conflict-resolution-output-message.md`] src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate. #cli #curate #conflicts #output

## By topic

- **#conflicts (4):** Conflict files (conflicts/<run-id>-<n>.md), Curator never auto-resolves contradictions, Curate CLI conflict output names the three resolution outcomes, curate CLI conflict-resolution output message
- **#curator (4):** Conflict files (conflicts/<run-id>-<n>.md), Curator action (add / modify / contradict / drop), Curator never auto-resolves contradictions, Curator drops non-productive and change-oriented candidates
- **#cli (3):** curate (CLI command + /kk-curate skill), Curate CLI conflict output names the three resolution outcomes, curate CLI conflict-resolution output message
- **#schema (3):** Conflict files (conflicts/<run-id>-<n>.md), Curator action (add / modify / contradict / drop), Proposal candidate schema
- **#curate (2):** curate (CLI command + /kk-curate skill), curate CLI conflict-resolution output message
- **#action (1):** Curator action (add / modify / contradict / drop)
- **#anti-pattern (1):** Curator drops non-productive and change-oriented candidates
- **#calibration (1):** Curator drops non-productive and change-oriented candidates
- **#candidate (1):** Proposal candidate schema
- **#human-in-the-loop (1):** Curator never auto-resolves contradictions
- **#kenkeep (1):** Curate CLI conflict output names the three resolution outcomes
- **#kk-curate (1):** Curate CLI conflict output names the three resolution outcomes
- **#output (1):** curate CLI conflict-resolution output message
- **#prompts (1):** Curator drops non-productive and change-oriented candidates
- **#proposal (1):** Proposal candidate schema
- **#skill (1):** curate (CLI command + /kk-curate skill)
- **#ux (1):** Curate CLI conflict output names the three resolution outcomes
