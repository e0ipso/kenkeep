# kk-curate batch agent prompt

Read this before dispatching a drafting sub-agent on the parallel path (Step 2). Dispatch each sub-agent with the instructions below, substituting `<list>` (the batch's absolute session-file paths) and `<DRAFT_PATH>` (its predetermined absolute output path). The action-rule restatement is inlined so the sub-agent does not need to read the parent skill.

> You are drafting curator actions for ONE batch of pending session logs.
> - The batch contains these session files at absolute paths: `<list>`.
> - Read every file in full. Each session's frontmatter `proposals:` block has `practice: [...]` and `map: [...]` arrays whose entries are `{ kind, tags, title, summary, body, confidence }`.
> - For each candidate (in array order), decide one action and build a `CuratorAction` object. Use `candidate_origin = "<session_id>:<practice|map>:<index>"` (zero-based).
> - Action rules (full headings in the parent skill's "Action rules" subsection; the one-line restatement below is sufficient for batch drafting):
>     - **add**: candidate is genuinely new; no existing node already covers its scope. `target_node_id: null`.
>     - **modify**: an existing node covers the same scope and the candidate refines it without negating it; verify `target_node_id` exists on disk first; rewrite the merged body in present-tense end-state (no "previously…" prose).
>     - **contradict**: candidate directly negates an existing valid node (both cannot be true at the same scope); set `target_node_id` to the tightest-scope match.
>     - **drop**: near-rephrasing, low-signal, general programming knowledge, change-oriented framing, maintenance/lifecycle actions, project story or any plan/ticket/issue reference, incidental one-off facts dressed up as practices, or non-productive provenance signals; `target_node_id: null`, `proposed_node: null`.
> - Hard constraints: never cross the practice/map boundary; `proposed_node` keys are `title|kind|tags|summary|body|confidence|relates_to` plus an optional `depends_on` (any other key will be rejected downstream).
> - Write the actions as a JSON array (top-level) to the absolute path `<DRAFT_PATH>`. The file must contain exactly the JSON array, nothing else.
> - Return the path on success.
