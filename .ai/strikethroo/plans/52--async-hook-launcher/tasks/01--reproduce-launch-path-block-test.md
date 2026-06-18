---
id: 1
group: "async-hook-launcher"
dependencies: []
status: "completed"
created: 2026-06-18
skills:
  - vitest
  - node-process
---
# Reproduce and confirm the launch-path block with a harness-agnostic test

## Objective
Establish, with an executable test, that the hook entry path can be killed
before it detaches when stdin is held open without EOF under a bounded host
timeout. The test must confirm the harness-agnostic root cause (it must fail or
demonstrate the block against the current code) and is written so that once
Task 2's fix lands it becomes the passing regression test. Coverage must span
every detach-reliant harness (Codex, Cursor, Copilot), not Codex alone.

## Skills Required
- `vitest` — author the test against the existing process-spawning test suite.
- `node-process` — drive a real spawned hook binary, hold its stdin open
  without sending EOF, and impose a bounded timeout to observe blocking.

## Acceptance Criteria
- [ ] A new test case exists in `tests/hooks/kk-proposal-drain.test.ts` that
      spawns the real proposal-drain hook binary with stdin held open and never
      closed (no EOF), under a bounded timeout shorter than any real host
      timeout.
- [ ] The test asserts the launch-path invariant: the parent hook process must
      return/exit before the bounded timeout while the work is detached. Against
      the current (unfixed) code this case demonstrates the block (documented as
      the confirmed root cause); the same case is designed to pass once Task 2
      lands.
- [ ] The case is exercised for each detach-reliant harness path (Codex,
      Cursor, Copilot) — parametrized or repeated — so the invariant is asserted
      harness-agnostically rather than Codex-only.
- [ ] The determination (does `runHookEntry` reach `detachSelf`, or stall in
      `readStdin()`?) is captured in the test's comments/description as the basis
      for the fix.
- [ ] No production source files are modified by this task.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Extend `tests/hooks/kk-proposal-drain.test.ts`, which already spawns real hook
  binaries and asserts non-blocking return; add the held-open-stdin / no-EOF
  case there.
- Reproduce the adverse condition against the launch path itself: spawn the
  compiled hook, attach a writable stdin that is never ended, and bound the wait
  with a timeout representing the host's hook timeout.
- The relevant code under test: `src/lib/hook-entry.ts` (`runHookEntry` performs
  `await readStdin()` before `detachSelf`), `src/lib/stdin.ts` (`readStdin()`
  resolves only on stdin `end`/`error`, or immediately when `isTTY`), and
  `src/lib/hook-detach.ts` (`detachSelf`).

## Input Dependencies
None. This is the gating task for the plan.

## Output Artifacts
- A harness-agnostic, held-open-stdin/no-EOF test case in
  `tests/hooks/kk-proposal-drain.test.ts` that confirms the root cause and
  serves as the regression test for Task 2.
- A documented determination of whether the block is the `readStdin`-before-
  `detachSelf` ordering (the hypothesis) or some other cause (e.g. inherited
  keep-alive handle, process-group signalling), used to scope Task 2.

## Implementation Notes
This task gates the rest of the plan: the exact fix in Task 2 depends on what
this reproduction reveals. Do not assume the stdin-ordering hypothesis — assert
it. If the evidence contradicts the hypothesis, record the actual cause so
Task 2 can be re-scoped (the plan's Component 1 explicitly allows this).

**Test philosophy — "write a few tests, mostly integration":**

Meaningful tests verify custom business logic, critical paths, and edge cases
specific to this application. Test *your* code, not the framework or library.

When TO write tests: custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic
or calculations.

When NOT to write tests: third-party library functionality; framework features;
simple CRUD operations without custom logic; trivial getters/setters or static
configuration; obvious functionality that would break immediately if incorrect.

Test task creation rules: combine related test scenarios into a single task;
favor integration and critical-path coverage over per-method unit tests; avoid
one test task per CRUD operation; question whether simple functions need a
dedicated test task.

This case is squarely a critical-path integration test of the launch path — the
defect is real and reproducible — so it belongs here. Keep it to the single
held-open-stdin invariant (parametrized over the three harnesses); do not add
speculative per-method unit tests around `stdin.ts`.

<details>
<summary>Detailed implementation guidance</summary>

1. Open `tests/hooks/kk-proposal-drain.test.ts` and locate the existing
   detach-timing tests that spawn real hook binaries and assert the hook returns
   promptly.
2. Add a new test (or `describe.each` over the detach-reliant harnesses: Codex,
   Cursor, Copilot) that:
   - Builds/locates the compiled proposal-drain hook binary the suite already
     uses.
   - Spawns it with `stdio` configured so the child's stdin is a pipe the test
     controls and **never** ends (do not call `.end()` / do not send EOF).
   - Races the child's exit against a bounded timeout (well under any real host
     timeout, e.g. a few seconds) and asserts the parent process exits before
     that timeout.
3. Run the suite. Against current code, expect the parent to NOT exit before the
   timeout (the block), confirming the root cause. Capture this observation in a
   comment. Inspect whether the process is stuck awaiting stdin EOF in
   `readStdin()` (the ordering hypothesis) versus another cause; note the
   finding.
4. Ensure the assertion is phrased as the desired invariant (parent returns
   before timeout, work continues detached) so that after Task 2 the same test
   passes unchanged. Also assert, where feasible, that the detached child still
   performs the drain (e.g. a proposal log entry appears) so a "fast return that
   skips work" cannot make the test green falsely.
5. Do not edit any file under `src/`.

</details>
