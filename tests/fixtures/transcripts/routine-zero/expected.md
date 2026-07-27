# Expected proposal output for transcript-routine-zero-capture.md

The correct output is empty:

```json
{
  "practice": [],
  "map": []
}
```

## Why each piece of content does NOT qualify

| Content in transcript | Why it's not knowledge |
|---|---|
| Bug fix in `parseDate.ts` (empty string handling) | Generic bug; the user noticed and corrected the agent on a behavior, but the "convention" — guard against empty input — is general programming knowledge, not project-specific. |
| Tests passing | Routine verification, not knowledge. |
| Refactor of `formatCurrency` signature | Pure refactor with no architectural change. The user didn't teach the agent anything project-specific; they just dictated a mechanical change. |
| `capitalizeFirst` helper | Routine method implementation that worked first try. No correction, no rationale, no project-specific convention. |
| `Array.prototype.reduce` explanation | General programming knowledge, derivable from MDN. Not project-specific. |
| The "TODO: move to queue-based email" mention | Aspirational. The user explicitly said "leave it for now" — it's a TODO, not a convention. The system explicitly skips aspirational content. |
| JSDoc addition | Routine documentation work. |
| Commit step | Routine workflow. |

## Failure modes this fixture catches

A prompt that over-captures would mistakenly produce:

- **False positive 1:** A practice node about "always guard against empty inputs in parsing functions." Wrong because this is general defensive programming, not a project rule the user taught.
- **False positive 2:** A practice node about "always update all call sites when changing a function signature." Wrong because the user gave this as a one-off instruction, not a stated convention. The prompt rules say to look for "we always X" or "the standard way is Y" — the user said neither.
- **False positive 3:** A map node about `parseDate`, `formatCurrency`, or `capitalizeFirst`. Wrong because these are utility functions any TypeScript project might have; their existence isn't project-specific vocabulary.
- **False positive 4:** A practice node about "we should move email to queue-based delivery." Wrong because this is a TODO, not a current convention.
- **False positive 5:** A map node about an "email service" because the TODO mentioned `src/services/email.ts`. Wrong because mere mention of a file path doesn't make it project-specific vocabulary worth recording; it's just a standard "services" directory pattern.

## Calibration target

This fixture is the **lower bound** test. If the prompt produces anything at all here, it's over-capturing. Combined with the rivermark-discover fixture (which is the **upper bound** test — substantial content that should produce 7 candidates), these two fixtures bracket the prompt's calibration.
