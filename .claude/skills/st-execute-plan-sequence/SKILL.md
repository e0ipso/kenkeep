---
name: st-execute-plan-sequence
description: Orchestrate sequential Strikethroo blueprint execution across multiple plan IDs. Spawns one subagent per plan, waits for completion, merges each plan's feature branch into main, then starts the next plan. Use when the user supplies an ordered list of plan IDs (e.g. 54, 55, 56) and wants all plans executed end-to-end with code landed on main.
---

# st-execute-plan-sequence

Orchestrate multiple Strikethroo plans **in strict order**. Each plan runs in its own subagent via the `st-execute-blueprint` skill. The orchestrator never executes blueprint tasks itself — it validates readiness, dispatches subagents, merges to `main`, and advances.

## Critical Rules

1. **Strict sequencing** — never start plan N+1 until plan N is archived and merged into `main`.
2. **One subagent per plan** — each subagent owns the full `st-execute-blueprint` lifecycle for its plan ID.
3. **Clean main between plans** — before dispatching the next plan, `main` must have a clean working tree and pass post-merge verification.
4. **Fail closed** — if a subagent fails, a merge fails, or post-merge validation fails, halt the sequence and report which plan blocked progress.
5. **Do not skip validation gates** — subagents must honor every hook in `st-execute-blueprint`; the orchestrator re-runs smoke checks after each merge.

## Inputs

The user supplies an ordered list of numeric plan IDs (e.g. `54, 55, 56`). Treat that list as authoritative. Do not reorder, skip, or add plans unless the user explicitly changes the list mid-run.

## Operating Procedure

### 1. Locate the strikethroo root

Run `../st-execute-blueprint/scripts/find-strikethroo-root.cjs` from the user's working directory. If it exits non-zero, stop and ask the user to initialize Strikethroo first.

Treat the printed path as `<root>` for the rest of this skill.

### 2. Validate the full sequence upfront

For **each** plan ID in the user's list, run:

```sh
node .claude/skills/st-execute-blueprint/scripts/validate-plan-blueprint.cjs <plan-id> taskCount
node .claude/skills/st-execute-blueprint/scripts/validate-plan-blueprint.cjs <plan-id> blueprintExists
node .claude/skills/st-execute-blueprint/scripts/validate-plan-blueprint.cjs <plan-id> planDir
```

Requirements before dispatch:

- `taskCount` > 0
- `blueprintExists` is `yes`
- Plan directory lives under `<root>/plans/` (not already archived)

If any plan fails validation, stop and report the failing ID. Do not start partial execution.

### 3. Confirm git baseline

From the repository root:

```sh
git checkout main
git pull --ff-only origin main   # best-effort; continue if offline
git status --porcelain
```

If the working tree is not clean, stop and ask the user to commit or stash before continuing.

Record `START_SHA=$(git rev-parse HEAD)` for the final summary.

### 4. Execute each plan sequentially

Maintain an internal tracker. For plan index `i` of `N`:

**Progress indicator** (informational only — do not pause):

```
⬛ repeated i times, ⬜ repeated N-i times — Plan {plan-id} ({i}/{N})
```

#### 4a. Dispatch subagent

Spawn exactly **one** subagent using the internal Task tool. The subagent prompt MUST include:

1. Read and follow `.claude/skills/st-execute-blueprint/SKILL.md` in full.
2. Execute plan ID `{plan-id}` only — do not touch other plans.
3. Start from a clean `main`; run `create-feature-branch.cjs {plan-id}` before implementation.
4. Execute every blueprint phase with hooks (`PRE_PHASE`, `PRE_TASK_EXECUTION`, `POST_PHASE`, `POST_EXECUTION`).
5. Commit work on the feature branch using conventional commits at each phase boundary (per `POST_PHASE.md`).
6. Append the execution summary and archive the plan directory to `<root>/archive/`.
7. End with the exact `st-execute-blueprint` closing block:

```
---
Execution Summary:
- Plan ID: {plan-id}
- Status: Archived
- Location: [absolute path to archive directory]
---
```

Also capture the feature branch name (`feature/{plan-id}--{slug}`) in the subagent output.

**Do not** proceed until the subagent returns success and the closing block parses cleanly.

#### 4b. Merge feature branch to main

From repo root:

```sh
git checkout main
git merge --no-ff "feature/{plan-id}--{slug}" -m "$(cat <<'EOF'
feat: merge plan {plan-id} blueprint execution

Land implementation from Strikethroo plan {plan-id}.

EOF
)"
```

If the branch name differs from the default pattern, use the branch name reported by the subagent.

If merge conflicts occur, halt the sequence and report the conflict — do not auto-resolve without user direction.

#### 4c. Post-merge verification

Run after every merge:

```sh
npm run typecheck
npm test
git status --porcelain
```

If any command fails or the tree is dirty, halt the sequence. Leave `main` as-is for debugging; do not start the next plan.

Optionally delete the merged feature branch:

```sh
git branch -d "feature/{plan-id}--{slug}"
```

#### 4d. Advance

Increment `i` and repeat §4 for the next plan ID.

### 5. Final summary

After all plans complete, emit exactly:

```
---
Sequence Execution Summary:
- Plans: [comma-separated IDs]
- Status: All merged to main
- Start SHA: [START_SHA]
- End SHA: [git rev-parse HEAD]
- Archived:
  - Plan [id]: [archive path]
  - ...
---
```

## Failure Modes

| Failure | Action |
| --- | --- |
| Plan missing tasks or blueprint | Stop before dispatch; list failing IDs |
| Subagent returns without archived status | Halt; do not merge |
| Merge conflict | Halt; report plan ID and conflicting paths |
| `npm test` / `typecheck` fails post-merge | Halt; next plan does not start |
| Plan already in `archive/` | Stop upfront validation — plan was already executed |

## Subagent Contract

Each subagent is a **full** `st-execute-blueprint` runner. The orchestrator MUST NOT implement blueprint tasks inline. Parallelism inside a plan (across tasks in the same phase) is the subagent's responsibility per `st-execute-blueprint`.

## Example Invocation

User: "Run plans 54, 55, 56 in sequence and merge each to main."

Orchestrator: validate 54 → 55 → 56 → dispatch subagent(54) → merge → verify → dispatch subagent(55) → merge → verify → dispatch subagent(56) → merge → verify → emit sequence summary.
