---
id: 3
group: "prompt-time-knowledge-injection"
dependencies: [1, 2]
status: "completed"
created: 2026-06-20
skills:
  - vitest
  - harness-adapters
complexity_score: 6
complexity_notes: "Covers retrieval, confirmed prompt hooks, unsupported harness assertions, and session-start non-regression without exploding into per-harness task files."
---
# Add Prompt Injection Regression Coverage

## Objective
Add focused regression tests that verify prompt-time knowledge injection works for supported harnesses and does not change existing session-start delivery.

## Skills Required
Vitest for fixture and integration-style tests, and harness adapter knowledge for host-specific hook/config assertions.

## Acceptance Criteria
- [ ] Retrieval tests from task 1 and hook integration tests cover prompt-specific relevance, bounded payload size, and omission of unrelated low-relevance nodes.
- [ ] Claude and Codex each have a fixture or hook/config test that proves a `UserPromptSubmit` payload produces summaries and links in the native output shape.
- [ ] Unsupported harnesses are asserted to remain unsupported or unregistered, rather than silently receiving a fake translated event; include Copilot coverage proving no `userPromptSubmitted` prompt-injection registration exists unless task 2 verified a changed contract.
- [ ] Existing session-start tests still pass and include a regression check that `ENTRY.md`, curation nudges, and stale-index warnings are not unintentionally changed.
- [ ] Hook build output is regenerated from source before tests that execute built hook bundles.
- [ ] `npm run build`, `npm test`, `npm run typecheck`, and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the existing Vitest stack and harness fixture style. Tests should not require a real harness binary; follow the repository convention that harness binaries are mocked where needed. Keep coverage weighted toward meaningful integration paths and custom retrieval logic. Avoid broad snapshot tests of full rendered payloads; assert the stable contract fields, bounds, links, and omissions.

## Input Dependencies
Depends on task 1 for retrieval behavior and task 2 for adapter/hook wiring.

## Output Artifacts
- Prompt retrieval fixture tests.
- Supported-harness prompt hook/config tests for Claude and Codex.
- Unsupported-harness assertions for Cursor, OpenCode, and Copilot unless task 2 intentionally verified and implemented more support.
- Session-start non-regression coverage.
- Passing local validation output from `npm run build`, `npm test`, `npm run typecheck`, and `npm run lint`.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Test philosophy: write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Write tests for custom ranking logic, prompt-to-node transformations, hook payload integration, and error conditions that affect prompt injection. Do not write tests for third-party library behavior, trivial getters/setters, static config that has no custom logic, or obvious behavior that would break immediately if incorrect.

Prefer compact fixture trees with a few nodes whose titles, tags, summaries, bodies, and edges intentionally compete. Include one unrelated prompt case to prove low-relevance nodes are omitted. Add a fixture where a graph edge or redirect changes ordering only as a small deterministic influence, not as a replacement for lexical relevance.

For hooks, execute the built `.cjs` bundles the same way `tests/hooks/kk-session-start.test.ts` does, passing representative stdin payloads and parsing stdout. Assert that errors, missing prompts, and missing KBs exit successfully with no injected context.

Run `npm run build`, `npm test`, `npm run typecheck`, and `npm run lint` after implementation. If build output changes are required for hook templates, include the appropriate build step before tests that inspect generated templates.
</details>
