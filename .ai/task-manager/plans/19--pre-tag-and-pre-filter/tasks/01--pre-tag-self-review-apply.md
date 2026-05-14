---
id: 1
group: "transcript-rendering"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---

# Deterministically tag /self-review-apply turns in renderRoleTagged

## Objective
Annotate the rendered transcript at `renderRoleTagged` so a `/self-review-apply <path>.xml` user turn renders as `[USER /self-review-apply <path>]: ...` and the immediately following agent segment (if any) renders as `[AGENT NARRATION OF SELF-REVIEW <path>]: ...`. The prompt can then drop its filename-variance defence and key off a fixed tag.

## Skills Required
- typescript: edit the renderer in `src/lib/transcript.ts` and add Vitest unit coverage in `tests/lib/transcript.test.ts`.

## Acceptance Criteria
- [ ] `renderRoleTagged` detects a user segment whose text matches `/^\s*\/self-review-apply\s+(\S+\.xml)\s*$/` and emits `[USER /self-review-apply <captured-path>]: <original text>` for that segment.
- [ ] When the next segment is an agent segment, it renders as `[AGENT NARRATION OF SELF-REVIEW <captured-path>]: <original text>`; when the next segment is anything else (or absent), only the user segment is tagged.
- [ ] Non-trigger segments render unchanged as `[USER]: ...` / `[AGENT]: ...`.
- [ ] Unit tests cover: (a) no slash command (unchanged output), (b) trigger with following agent segment (both tagged), (c) trigger with no following segment (only user tagged), (d) trigger followed by another user segment (only user tagged), (e) a user body that mentions `/self-review-apply foo.xml` inside a longer message — i.e. surrounded by other text on the same or other lines — is **not** tagged because the regex requires the whole segment body to be the invocation.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File: `src/lib/transcript.ts`. Current implementation at lines 73-77 maps each segment to `[ROLE]: text` and joins with `\n\n`.
- File for tests: `tests/lib/transcript.test.ts` (create if missing; align with the repo's existing Vitest setup).
- The captured `<path>` token is whatever `\S+\.xml` matches; preserve it verbatim in both tags.

## Input Dependencies
None.

## Output Artifacts
- Updated `renderRoleTagged` that emits the new role markers for trigger pairs while preserving existing segment bodies.
- New tests in `tests/lib/transcript.test.ts` exercising the five scenarios listed above.

## Implementation Notes

<details>

Replace the body of `renderRoleTagged` with a forward scan that, for each segment, decides what role marker to emit. Pseudocode:

```ts
const TRIGGER_RE = /^\s*\/self-review-apply\s+(\S+\.xml)\s*$/;

export function renderRoleTagged(t: RoleTaggedTranscript): string {
  const segs = t.interleaved;
  const lines: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.role === 'user') {
      const m = TRIGGER_RE.exec(seg.text);
      if (m) {
        const path = m[1];
        lines.push(`[USER /self-review-apply ${path}]: ${seg.text}`);
        const next = segs[i + 1];
        if (next && next.role === 'agent') {
          lines.push(`[AGENT NARRATION OF SELF-REVIEW ${path}]: ${next.text}`);
          i += 1; // consume the agent segment
        }
        continue;
      }
      lines.push(`[USER]: ${seg.text}`);
    } else {
      lines.push(`[AGENT]: ${seg.text}`);
    }
  }
  return lines.join('\n\n');
}
```

Notes:
- The regex matches against the unrendered segment body, which is what the renderer already holds; the issue's transcript-level regex `/^\[USER\]:\s*\/self-review-apply\s+\S+\.xml\s*$/m` is the equivalent shape over the rendered string. Apply the segment-body form here.
- Preserve the original `seg.text` in the emitted line; do not strip whitespace from it.
- The agent-annotation branch consumes the next segment (`i += 1`) so it is not also rendered with the default `[AGENT]:` marker.
- If `next.role !== 'agent'` (next segment is another user segment, or absent), do not emit a narration tag. The user tag alone carries the trigger information.

Test fixtures (Vitest):

1. Empty / single non-trigger user segment → unchanged `[USER]: ...`.
2. `{role: 'user', text: '/self-review-apply feedback/round-2.xml'}` followed by `{role: 'agent', text: 'I worked through the comments...'}` → first line begins with `[USER /self-review-apply feedback/round-2.xml]:` and second line begins with `[AGENT NARRATION OF SELF-REVIEW feedback/round-2.xml]:`.
3. Trigger segment with no following segment → only the user line is tagged.
4. Trigger segment followed by another user segment → user is tagged; the second user segment renders as `[USER]: ...`.
5. `{role: 'user', text: 'I will run /self-review-apply foo.xml later today'}` → renders as `[USER]: I will run /self-review-apply foo.xml later today` (the regex requires the whole body to be the invocation).
6. (Optional) Trigger with leading/trailing whitespace: `'  /self-review-apply x.xml\n'` → tagged; the rendered body still contains the original whitespace.

If there is no existing `tests/lib/transcript.test.ts`, create one mirroring the layout of sibling tests (see `tests/lib/capture.test.ts` for import style and Vitest helpers).

Do not introduce a new module or helper; keep the rewrite inside `renderRoleTagged`.

</details>
