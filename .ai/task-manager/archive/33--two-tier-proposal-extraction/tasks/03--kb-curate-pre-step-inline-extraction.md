---
id: 3
group: "skill-template"
dependencies: [2]
status: "completed"
created: "2026-05-24"
skills: ["markdown"]
---
# Add Step 0 (inline extraction pre-step) to `/kb-curate` skill template

## Objective
Insert a new Step 0 into `src/templates-source/skills/kb-curate/SKILL.md` that drains remaining `pending` session logs inline before the existing curation flow begins. This ensures every user has a reliable path to extraction regardless of whether the async hook ran.

## Skills Required
Markdown prompt engineering — editing the skill template with precise instructions for the LLM executing the skill.

## Acceptance Criteria
- [ ] Step 0 is inserted in `src/templates-source/skills/kb-curate/SKILL.md` between "Resolve the active harness" and the current "1. Enumerate pending session logs"
- [ ] Step 0 lists `_sessions/*.md` files and filters for `proposal_status: pending`
- [ ] Step 0 short-circuits with a one-line note if no pending logs exist
- [ ] Step 0 reads the `proposal-extract.md` prompt (override path first, then bundled fallback)
- [ ] Step 0 processes each pending log sequentially in `captured_at` order
- [ ] Step 0 extracts transcript, applies extraction prompt, produces JSON matching `ProposalOutputSchema`
- [ ] Step 0 pipes results to `session-log update-proposals` CLI primitive
- [ ] Step 0 handles failures by calling the primitive with `--status failed --error "<message>"`
- [ ] Step 0 reports summary: "Extracted proposals from N session(s) (M failed). Proceeding to curation."
- [ ] The version comment is bumped from `<!-- Version: 3 -->` to `<!-- Version: 4 -->`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The new step goes between the "Resolve the active harness" section (ends around line 73) and the "## 1. Enumerate pending session logs" section (starts at line 76).
- Use a heading: `## 0. Drain remaining pending session logs (inline extraction)`
- The prompt file locations are: `.ai/knowledge-base/.config/prompts/proposal-extract.md` (per-repo override), then the bundled package template at the npm package's `templates/prompts/proposal-extract.md`.
- The CLI primitive invocation: `echo '<json>' | npx @e0ipso/ai-knowledge-base@latest session-log update-proposals <path> --status done`
- The `ProposalOutputSchema` expects `{ practice: [...], map: [...] }` where each entry has `{ kind, tags, title, summary, body, confidence }`.

## Input Dependencies
- Task 2 (CLI primitive `session-log update-proposals`) must be complete — Step 0 calls this command.

## Output Artifacts
- Modified file: `src/templates-source/skills/kb-curate/SKILL.md`

## Implementation Notes

<details>

### Insertion point

The new Step 0 goes after the "Resolve the active harness" section (which ends at line 73 with the closing of the bash block and the note about `$HARNESS`) and before "## 1. Enumerate pending session logs" (line 76).

### Step 0 content

The section should instruct the LLM executing the skill to:

1. **List pending session logs**: Use `Glob` (or `ls`) to list `.ai/knowledge-base/_sessions/*.md`. For each file, `Read` its frontmatter and filter for `proposal_status: pending`. Sort by `captured_at` ascending.

2. **Short-circuit**: If none are pending, print: `No pending session logs need extraction. Proceeding to curation.` and fall through to Step 1.

3. **Load the extraction prompt**: Read the proposal-extract prompt from the per-repo override path (`.ai/knowledge-base/.config/prompts/proposal-extract.md`) first. If that doesn't exist, read the bundled template. The skill should instruct the LLM to read the prompt file and follow its extraction rules.

4. **Process each pending log sequentially** (in `captured_at` order):
   a. Read the file in full.
   b. Extract the transcript section (content between `## Transcript` and `## Proposal`).
   c. Apply the extraction rules from the prompt to produce a JSON object: `{ "practice": [...], "map": [...] }`.
   d. Pipe the JSON into the CLI primitive:
      ```bash
      echo '<json>' | npx @e0ipso/ai-knowledge-base@latest session-log update-proposals <path> --status done
      ```
   e. On failure (malformed output, schema violation), call:
      ```bash
      npx @e0ipso/ai-knowledge-base@latest session-log update-proposals <path> --status failed --error "<message>"
      ```

5. **Report summary**: `Extracted proposals from N session(s) (M failed). Proceeding to curation.`

6. **Fall through**: Step 1 now picks up the freshly-`done` logs alongside any previously-`done` logs.

### Version bump

Change line 6 from `<!-- Version: 3 -->` to `<!-- Version: 4 -->`.

### Important notes for the step text

- The LLM executing Step 0 IS the extraction LLM — it reads the transcript and produces structured JSON directly. No headless CLI spawn.
- Reference the prompt by path, don't embed a copy — the prompt is the single source of truth.
- Make clear that failure on one log doesn't abort the rest — process all pending logs and report totals.

</details>
