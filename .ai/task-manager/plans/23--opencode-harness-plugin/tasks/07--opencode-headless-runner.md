---
id: 7
group: "opencode-adapter"
dependencies: [4]
status: "completed"
created: 2026-05-15
skills:
  - typescript
  - node
---

# Implement the OpenCode headless runner driving opencode run --format json

## Objective

`src/harnesses/opencode/headless.ts` exports `runHeadlessOpenCode(prompt, opts)` that spawns `opencode run` in headless mode, parses the JSON event stream, accumulates the final assistant message text, and returns it validated against a caller-supplied Zod schema. Mirrors the Codex headless runner's contract.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `runHeadlessOpenCode(prompt: string, opts: HeadlessRunOptions & { harnessOpts: OpenCodeHarnessOpts, schema: ZodType }): Promise<T>` lives at `src/harnesses/opencode/headless.ts`
- [ ] Spawns `opencode run "<prompt>" --format json --model <provider>/<model>` with `--agent <id>` appended only when `harnessOpts.agent` is set
- [ ] Reads the newline-delimited JSON event stream from stdout
- [ ] Accumulates `message.part.updated` text deltas for the last assistant message id; resets accumulator on `session.created`
- [ ] After `session.idle` (or stream end), parses the accumulated string as JSON and validates against `opts.schema`. Throws a descriptive error if either step fails (`Could not parse opencode output as JSON: <first 200 chars>` is helpful)
- [ ] Honors `opts.timeoutMs`, `opts.logFile` (raw stream tee to file when set), `opts.onMessage` callback for each parsed event
- [ ] Sets `KB_BUILDER_INTERNAL=1` on the child env so the spawned opencode's plugin no-ops
- [ ] Adapter `runHeadless` in `index.ts` (placeholder from Task 4) is replaced with a call to `runHeadlessOpenCode`
- [ ] Unit test exercises the runner with a fake `opencode` shim that emits a canned event stream (write a Node script to stdout that prints the events with small delays). Confirm the runner returns the parsed Zod-validated value
- [ ] `npm run build` succeeds; `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/opencode/headless.ts`
- `execa` for the spawn
- `split2` for line-delimited reading (existing dependency)
- `zod` for schema validation

## Input Dependencies

- Task 4 (adapter scaffold + opts schema)

## Output Artifacts

- Working headless runner enabling `curate` and `bootstrap-incremental` against OpenCode

## Implementation Notes

<details>
<summary>Guidance</summary>

- OpenCode's event stream contract (verified against the plan's research): events have a `type` discriminator and a `properties` payload. The text deltas arrive on `message.part.updated` events whose `properties.part.type === 'text'`. Concatenate `properties.part.text` (or the equivalent field) for each delta belonging to the most recent assistant message id.
- Use a state machine: track `currentAssistantMessageId`; on `session.created` clear it; on each `message.part.updated` whose message id differs from current, reset the buffer (because deltas for older messages are stale).
- For testing without the real CLI: write `tests/fixtures/fake-opencode.mjs` that prints a canned stream of events to stdout with `setTimeout` delays, then exits 0. Point the runner at it via an injectable `opts.opencodeCli` override (default `'opencode'`).
- Timeout: kill the child if `opts.timeoutMs` elapses before `session.idle`. Throw a `TimeoutError` with the accumulated buffer for debuggability.
- Per `feedback_no_backwards_compat`: do not implement a fallback parser for the older `--format text` mode; require `--format json`.

</details>
