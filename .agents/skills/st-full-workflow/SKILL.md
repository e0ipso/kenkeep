---
name: st-full-workflow
description: Execute the complete Strikethroo workflow from plan creation through blueprint execution for this repository. Use when the user asks to run the full end-to-end workflow for a work order — discovers the local .ai/strikethroo root, creates a plan, generates atomic tasks, and executes the blueprint, all in a single uninterrupted sequence. Do not use for individual plan creation, task generation, or blueprint execution; use the dedicated skills for those.
---

# st-full-workflow

Drive the complete end-to-end Strikethroo workflow — plan creation, task generation, and blueprint execution — by orchestrating the three component skills in sequence. Each component skill owns its own procedure; this skill owns only the bridges between them. The skill is assistant-agnostic and self-contained: every script it invokes lives under this skill's `scripts/` directory and is referenced by relative path.

## Critical Rule

Execute all three phases sequentially without waiting for user input between phases. This is a fully automated orchestration workflow. Progress indicators are for user visibility only and do not pause execution.

## Inputs

The user supplies the work order conversationally. Treat it as the only authoritative source of intent. Do not invent answers to clarifying questions — prompt the user instead.

## Context Passing Between Phases

Information flows between phases via the component skills' structured summary blocks:

1. **Phase 1 → Phase 2**: parse the numeric `Plan ID` from `st-create-plan`'s **Plan Summary** block. Use this exact ID to drive Phase 2.
2. **Phase 2 → Phase 3**: parse the `Tasks` count from `st-generate-tasks`'s **Task Generation Summary** block. Use it for progress tracking in Phase 3.

Do not proceed to the next phase until the current phase's structured summary has been successfully parsed.

## Progress Indicators

Display progress indicators at key transition points (informational only; never pause for input):

- `⬛⬜⬜ 33%` — Phase 1: Plan Creation Complete
- `⬛⬛⬜ 66%` — Phase 2: Task Generation Complete
- `⬛⬛⬛ 100%` — Phase 3: Blueprint Execution Complete

## Operating Procedure

### Locate the strikethroo root

Run `scripts/find-strikethroo-root.cjs` from the user's working directory. It walks up looking for `.ai/strikethroo/.init-metadata.json` and prints the absolute path of the resolved root. If it exits non-zero, the working directory is not inside an initialized strikethroo workspace — stop and ask the user to run the project initializer (e.g. `npx strikethroo init`). Do not run the workflow outside a valid root. Treat the printed path as `<root>` for every phase below.

### Phase 1: Plan Creation

**Progress**: `⬛⬜⬜ 33% - Phase 1/3: Starting Plan Creation`

Follow the **st-create-plan** skill's operating procedure in full for this work order. It loads project context, analyzes the work order, runs its clarification loop, allocates the next plan ID, emits the plan under `<root>/plans/`, runs the post-plan hook, and concludes with its **Plan Summary** block.

Parse the numeric `Plan ID` from that Plan Summary and carry it into Phase 2.

**Progress**: `⬛⬜⬜ 33% - Phase 1/3: Plan Creation Complete`

### Phase 2: Task Generation

**Progress**: `⬛⬜⬜ 33% - Phase 2/3: Starting Task Generation`

Follow the **st-generate-tasks** skill's operating procedure in full for the Plan ID from Phase 1. It resolves the plan, decomposes it into atomic tasks under the plan's `tasks/` directory, runs the `POST_TASK_GENERATION_ALL` hook to append the Execution Blueprint, and concludes with its **Task Generation Summary** block.

Parse the `Tasks` count from that summary and carry it into Phase 3 for progress tracking.

**Progress**: `⬛⬛⬜ 66% - Phase 2/3: Task Generation Complete`

### Phase 3: Blueprint Execution

**Progress**: `⬛⬛⬜ 66% - Phase 3/3: Starting Blueprint Execution`

Follow the **st-execute-blueprint** skill's operating procedure in full for the Plan ID. It validates that the plan has tasks and a blueprint (auto-generating via st-generate-tasks if either is missing), optionally creates a feature branch, executes every phase in dependency order with the `PRE_PHASE` / `PRE_TASK_EXECUTION` / `POST_PHASE` hooks, runs `POST_EXECUTION`, appends the execution summary, archives the plan from `plans/` to `archive/`, and concludes with its **Execution Summary** block.

Surface that Execution Summary as this workflow's own final output (see below).

**Progress**: `⬛⬛⬛ 100% - Phase 3/3: Blueprint Execution Complete`

## Failure Modes

- **No strikethroo root found.** Stop and instruct the user to initialize the project. Do not write any files or execute any tasks.
- **st-create-plan reports `needs-clarification` or stops in Phase 1.** If a blocking question cannot be answered, report `needs-clarification` and stop. Do not produce a partial plan.
- **A structured summary fails to parse.** Do not advance to the next phase; surface the missing block to the user and stop.
- **Plan ID does not resolve in Phase 2 or 3.** Stop and surface the component skill's stderr. Do not guess a different ID.
- **Missing blueprint after auto-generation in Phase 3.** If task generation fails to produce tasks or a blueprint, stop and report failure. Do not attempt execution without a blueprint.
- **Hook or execution failure.** If a `PRE_PHASE` / `POST_PHASE` / `POST_EXECUTION` hook fails or a task errors, the component skill halts and the plan remains in `plans/` for debugging. Follow `<root>/config/hooks/POST_ERROR_DETECTION.md`, document the error, and request user direction before continuing.

## Execution Summary

Conclude with exactly this block as the final output:

```
---
Execution Summary:
- Plan ID: [numeric-id]
- Status: Archived
- Location: [absolute path to archive directory]
---
```

The summary is consumed by downstream automation; keep the format exact.
