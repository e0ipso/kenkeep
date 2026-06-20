---
id: 3
group: "strikethroo-skill-refactor"
dependencies: [1]
status: "completed"
created: 2026-06-20
skills:
  - skill-docs
complexity_score: 5
complexity_notes: "The task touches several skill documents, but the edits are constrained to concision and delegation without code changes."
---
# Refactor Strikethroo Skills

## Objective
Shorten the scoped Strikethroo skills by removing duplicated or non-operational procedure text while keeping each component skill standalone and executable.

## Skills Required
Use `skill-docs` to rewrite skill procedures, preserve required structured outputs, and keep referenced component skills independently readable.

## Acceptance Criteria
- [ ] `st-full-workflow/SKILL.md` delegates by reference to `st-create-plan`, `st-generate-tasks`, and `st-execute-blueprint` instead of duplicating their procedures.
- [ ] `st-full-workflow` still preserves workflow-specific bridge context, progress indicators, failure handling, Plan ID parsing, task-count parsing, and blueprint execution handoff.
- [ ] `st-execute-task/SKILL.md` no longer contains the non-operational status-transition table, while actionable status checks remain.
- [ ] `st-refine-plan/SKILL.md` has the autonomous-clarification trigger list condensed to the plan's stated rule.
- [ ] `st-create-plan`, `st-generate-tasks`, and `st-execute-blueprint` remain standalone-readable after the workflow skill references them, including their required final structured summary blocks.
- [ ] No helper script invocation, field name, hook name, or final summary format in the scoped Strikethroo skills changes accidentally.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Edit only the scoped Strikethroo skill markdown files needed by the plan. Preserve structured final summary blocks, helper script invocations, field names, task/plan/blueprint template references, hook references, progress handoffs, and failure-mode behavior.

## Input Dependencies
Requires task 1's baseline checklist.

## Output Artifacts
- Updated `.agents/skills/st-full-workflow/SKILL.md`.
- Updated `.agents/skills/st-execute-task/SKILL.md`.
- Updated `.agents/skills/st-refine-plan/SKILL.md`.
- Any minimal supporting edits needed to keep referenced component skills standalone-readable.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Rewrite `st-full-workflow` as an orchestrator. It should instruct the agent to follow the component skills' authoritative procedures instead of embedding them.
2. Keep only the orchestration-specific details in `st-full-workflow`: root discovery context, handoff from created plan ID to task generation, task-count parsing, handoff to blueprint execution, progress reporting, and failure behavior.
3. In `st-full-workflow`, reference component skills by exact skill name and exact structured outputs to parse:
   - `Plan Summary` from `st-create-plan`.
   - `Task Generation Summary` from `st-generate-tasks`.
   - `Execution Summary` from `st-execute-blueprint`.
4. In `st-execute-task`, remove the status-transition reference table only. Do not remove checks that block execution of completed, in-progress, needs-clarification, missing, or dependency-incomplete tasks.
5. In `st-refine-plan`, replace the long autonomous trigger list with the concise rule from the plan: proceed autonomously only when the user explicitly asks for autonomous refinement or the upstream workflow declares autonomous operation; otherwise clarify interactively.
6. Read `st-create-plan`, `st-generate-tasks`, and `st-execute-blueprint` after the edits and confirm a future agent can execute them without relying on duplicated text from `st-full-workflow`.
7. Run a grep over the edited Strikethroo skills for removed text fragments and for preserved summary block labels before handing off to task 4.

</details>
