# Proposal extraction evaluation corpus

Corpus version: 2

Version 2 keeps the session corpus unchanged. It makes expected-point matching
punctuation-insensitive and adds explicit alternative substring sets for
faithful grammatical variants.

This corpus contains 24 frozen synthetic Drupal coding sessions and one
expected-label sidecar for each session. It evaluates
`src/templates-source/prompts/proposal-extract.md` Version 7 together with the
Version 2 knowledge admission criteria it references.

The fictional sessions use vocabulary from the 26-node Drupal fixture knowledge
base vendored under `tests/fixtures/retrieval-eval/drupal/`. The sessions are
synthetic and contain no real credentials, hosts, or personal data.

## Category distribution

| Category | Count | Expected output | What it tests |
|---|---:|---|---|
| `admit-convention` | 2 | 1 or more practice | Human teaches a project convention |
| `admit-prohibition` | 2 | 1 or more practice | Corrective prohibition with a replacement |
| `admit-gotcha` | 2 | 1 or more practice | Brittle integration or configuration behavior |
| `admit-rationale` | 1 | 1 or more practice | Durable decision with its reason |
| `admit-tooling` | 1 | 1 or more practice | Non-obvious project test invocation |
| `admit-map-feature` | 1 | 1 or more map | New system and its seams |
| `admit-map-vocab` | 1 | 1 or more map | Project-specific term and definition |
| `admit-map-location` | 1 | 1 or more map | Major system location and boundary |
| `reject-abandoned` | 2 | empty | Reversal without a replacement |
| `reject-exploratory` | 2 | empty | Options or hypotheses without a decision |
| `reject-unrelated` | 1 | empty | Off-project general programming help |
| `reject-meta-only` | 2 | empty | Planning and scoping without an adopted fact |
| `reject-noise` | 2 | empty | Routine implementation, reads, and typo fixes |
| `mixed-salvage` | 2 | subset | Durable rule separated from ticket history |
| `trap-phantom` | 2 | empty | Known rule-shaped false positives |

Total: 24 sessions.

## Transcript realism

The fixture bodies follow the text that capture preserves, not raw harness
event JSON. Tool invocations and results are represented by the assistant text
around them: intent before a read or command, partial findings, failed
assertions, corrected hypotheses, retries, and verification summaries. This
naturally produces consecutive `[AGENT]:` segments between the human's turns.

Each session stays within the corpus's 8 to 20 role-segment budget while
varying the user-to-agent ratio and amount of investigative noise. Slash-command
sessions use the captured `<command-message>` / `<command-name>` envelope plus
an injected skill-context turn instead of an artificial bare command turn.

## Kenkeep command traffic

Captured coding sessions can include the host's kenkeep skill invocations and
their narration. The corpus covers `/kk-add`, `/kk-bootstrap`, `/kk-curate`,
and `/kk-session-extract` without giving those maintenance workflows special
knowledge status:

- `reject-meta-only-01` and `reject-meta-only-02` keep curation and bootstrap
  maintenance sessions empty.
- `trap-phantom-01` and `trap-phantom-02` reject tempting rule-shaped content
  surfaced inside add and session-extract workflows.
- `admit-convention-01` confirms that a productive coding session retains its
  durable teaching point even when it ends with `/kk-session-extract`.

## Corpus-authoring prompt

The following is the complete corpus-authoring prompt used to refresh this
fixture set. Punctuation is normalized to the repository's prose style, but the
words, requirements, ordering, paths, and examples are otherwise unchanged.

```markdown
You are authoring an evaluation corpus for kenkeep's proposal-extraction prompt.
Work strictly inside this repository. Do not modify anything outside
`tests/fixtures/prompt-eval/`.

## Inputs to read first
1. `src/templates-source/prompts/proposal-extract.md`: the prompt under eval:
   the session-disposition gate (abandoned/exploratory/unrelated/meta-only),
   the scope filter, the end-state framing rule, and the confidence-bias rule.
2. `src/templates-source/prompts/knowledge-admission.md`: the keep/drop
   criteria (lifecycle actions, plan/ticket references, incidental facts, the
   six-months keep test, the salvage rule).
3. `PRD.md` section 6 ("What counts as knowledge"): the admit and reject lists.
4. The fixture knowledge base: every node under
   `tests/fixtures/retrieval-eval/drupal/nodes/` (a vendored snapshot of the
   kenkeep-pack-drupal knowledge pack). Absorb its vocabulary: module names,
   entity types, named conventions, tag set.

## Your task
Generate 24 synthetic AI-coding-session logs plus one expected-labels sidecar
each, following EXACTLY the category table, counts, and sidecar YAML schema in
the corpus specification (`tests/fixtures/prompt-eval/README.md`, which contains
this prompt and the table). File layout:
- `tests/fixtures/prompt-eval/sessions/<category>-<nn>.md`
- `tests/fixtures/prompt-eval/expected/<category>-<nn>.yaml`

## Session log format (must match exactly)
YAML frontmatter, then role-tagged body:

    ---
    schema_version: 1
    session_id: <a valid, unique UUID v4, fixed, not random per run>
    harness: claude
    captured_at: '2026-01-15T10:00:00.000Z'
    ---
    [USER]: <message>
    [AGENT]: <message>
    ...

## Realism requirements: these decide whether the eval means anything
- Sessions are set in a fictional Drupal project that USES the fixture KB's
  world: reference its real module names, entity types, and conventions so the
  content is domain-plausible. Invent only what the scenario needs.
- 8 to 20 turns each. Include realistic agent behavior: file reads, greps, patch
  summaries, test runs, the noise the extractor must see through.
- Every ADMIT fixture must contain a genuine TEACHING MOMENT: the human corrects
  the agent or introduces something new that the agent could not have derived
  from the codebase. The knowledge must NOT already be stated verbatim in the
  fixture KB (those duplicate-teaching sessions are a different, future corpus).
- Every REJECT fixture must be a plausible, productive-looking conversation that
  a naive extractor WOULD mine, that is the point. Make the traps tempting:
  e.g. a meta-only planning session where the user says "let me state it as a
  rule: ...", or a one-off circumstance phrased like a convention.
- MIXED-SALVAGE fixtures must interleave one durable rule with plan/ticket
  narration ("this is for ticket DRP-482 ...") so that only the rewritten rule
  should survive; put the ticket references in `must_not_match`.
- No real secrets, tokens, hostnames, or personal data, not even fake-looking
  ones (no `sk-...`, no `password=`). The corpus is committed to a public repo.
- Vary the human's voice across sessions (terse, verbose, irritated, precise).
  Do not reuse sentence templates between fixtures.

## Labeling requirements
- For each expected point choose 2 to 4 distinctive lowercase substrings
  (module names, entity types, specific verbs) that appear naturally in any
  faithful extraction of the rule, never generic words like "use", "always",
  or "config". Use `must_match_all` for one required set. When faithful
  grammatical variants cannot share one natural substring set, use
  `must_match_any` with two or more complete alternative sets instead. Do not
  specify both fields on one expected point.
- `max_unexpected_proposals: 0` everywhere except where the category spec says
  otherwise.
- Write the `notes:` field for a human reviewer in one sentence.

## Self-check loop before you finish (all deterministic, run them)
1. Frontmatter of every session parses and `session_id` values are unique,
   valid UUID v4.
2. Every session has exactly one sidecar and vice versa; `fixture_id` matches
   the basename.
3. For every ADMIT/MIXED sidecar: manually verify every `must_match_all` term,
   or every term in each `must_match_any` alternative, against the session's
   teaching content (else the fixture is unwinnable). For every REJECT sidecar:
   `expect_empty: true` and `expected_points: []`.
4. Category counts match the specification table exactly.
Fix any failure and re-check. Then stop and list every file you created with a
one-line description, the maintainer reviews and commits; do not commit.
```

## Refresh procedure

Refresh deliberately. Do not fetch pack content during tests and do not carry
old labels forward without review.

1. Confirm the desired versions of `proposal-extract.md`,
   `knowledge-admission.md`, and PRD section 6. Record any version changes above.
2. Confirm the vendored Drupal fixture commit in
   `tests/fixtures/retrieval-eval/drupal/README.md`. If it changed, read every
   node again before authoring.
3. Re-run the authoring prompt in a supervised interactive session at the
   repository root. Replace all sessions and sidecars as one corpus revision.
4. Run the deterministic pairing, YAML, UUID, category-count, role-segment,
   command-envelope, teaching-term, secret-pattern, and punctuation checks. Fix
   every finding.
5. Review every session and sidecar in the diff. Reject a weak fixture by
   deleting and re-authoring it, then record the new corpus version here.

The checked-in fixtures are the only corpus used for prompt extraction scoring.
Normal tests never invoke an LLM. The explicit `prompt-eval` maintainer script
is the only automated path that sends these fixtures through a harness.
