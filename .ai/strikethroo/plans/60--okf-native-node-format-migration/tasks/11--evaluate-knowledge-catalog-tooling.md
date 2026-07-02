---
id: 11
group: "evaluation"
dependencies: [9]
status: "pending"
created: 2026-07-02
skills:
  - evaluation
  - documentation
complexity_score: 4
complexity_notes: "Evaluation-first: real runs of two external tools against the migrated bundle producing a written adoption decision; integration only if a clear win is found."
---
# Evaluate the knowledge-catalog reference agent and visualizer

## Objective
Run the knowledge-catalog reference agent and interactive visualizer against the
migrated v3 kenkeep bundle and produce a written adoption decision per tool,
grounded in an actual run — assessing the reference agent against kenkeep's
existing bootstrap/curation pipeline and the visualizer as a net-new browsing
capability — performing integration work only where the evaluation finds a clear
win over existing kenkeep machinery.

## Skills Required
- **evaluation** — run each tool and judge fit against kenkeep's machinery.
- **documentation** — record the adoption decision and rationale.

## Acceptance Criteria
- [ ] The knowledge-catalog repository is cloned and its reference agent and interactive visualizer are actually run against the migrated `.ai/kenkeep/nodes/` bundle.
- [ ] The visualizer run captures a screenshot showing kenkeep nodes rendered with resolvable links, and records observed behavior including any mishandling of `kk_` extension keys.
- [ ] A written adoption decision exists for BOTH tools (replace / augment / introduce / no-adoption) with rationale, captured as a kenkeep node.
- [ ] Any integration performed is limited to where the evaluation found a clear win; a documented "no adoption" outcome is acceptable.
- [ ] Verification: the evaluation deliverable (node) exists and names, per tool, the run performed, the observed result, and the decision; `grep -rIl "knowledge-catalog" .ai/kenkeep/nodes` locates the captured decision node.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Requires a clone of GoogleCloudPlatform/knowledge-catalog and whatever runtime
  its visualizer and reference agent need (evaluation-only dependency).
- The deliverable is the written decision; integration is conditional.

## Input Dependencies
- Task 9: the migrated v3 bundle to run the external tools against.

## Output Artifacts
- A kenkeep node capturing the per-tool adoption decision and rationale, plus any
  clearly-won integration.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Clone GoogleCloudPlatform/knowledge-catalog and set up the runtimes its OKF
   reference agent and interactive visualizer require.
2. Run the visualizer against the migrated `.ai/kenkeep/nodes/` bundle; confirm
   indexes render, `kk_` extensions are tolerated, and links resolve. Capture a
   screenshot and note any mishandling.
3. Run the reference agent (an OKF bundle producer) and compare it against
   kenkeep's deterministic, supervised, edge-aware bootstrap/curation pipeline —
   the prior expectation is overlap, not win, but run it before concluding.
4. Write a per-tool decision (replace / augment / introduce / no-adoption) with
   rationale and capture it as a kenkeep node via the normal add/curation path.
5. Only perform integration (documentation pointer, skill, etc.) where the
   evaluation finds a clear win; "no adoption" is a valid, documented outcome.
</details>
