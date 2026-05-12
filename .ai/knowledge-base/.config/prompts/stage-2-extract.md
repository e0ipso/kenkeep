# Stage-2 Extraction Prompt

<!--
  Version: 1
  Used by: kb-stage2-drain.mjs (via `claude -p`)
  Owner contract: produces the structured `proposals.practice` and `proposals.map` arrays
  for a session log. Must emit one JSON object on stdout as the final message.
-->

You are extracting reusable project knowledge from a transcript of an AI coding session. Your job is to identify the small subset of session content that represents **knowledge worth remembering across sessions** — and ignore everything else, which is the vast majority.

The transcript is provided as role-tagged segments below. Each segment is prefixed with `[USER]:` or `[AGENT]:`. You will run two extraction passes and produce a single combined JSON output at the end.

---

## What you are looking for

There are exactly two kinds of knowledge worth capturing:

### Practice nodes — "how we build things"

These are imperative, action-guiding statements about how this project does things. They include:

- **Conventions:** "When doing X, use Y." "We always do A before B."
- **Prohibitions:** "Don't use approach Z." "Never call this method directly."
- **Gotchas:** "If you do X the obvious way, it breaks because of Y."
- **Decision rationale:** "We chose A because B didn't handle case C." Rationale makes a practice node much more durable; capture it when you see it.
- **Tooling/workflow:** "Tests run with command X." "Deploys go through pipeline Y."

**Practice nodes are extracted strictly from `[USER]:` turns.** The user is the source of project-specific knowledge; the agent's text is context only. If the agent says "So you want me to use X for Y" after the user said "use X for Y," do not treat the agent's paraphrase as a teaching moment — the user's statement is the source. Quote or paraphrase from the user's turn.

### Map nodes — "what exists in this project"

These describe the entities, features, vocabulary, and locations of the project:

- **Features:** "Bravo Insider is our personalized section for authenticated users."
- **Vocabulary:** Project-specific names and what they mean. "CardSourceResolver is the service that picks which entities go into a feed."
- **Module/file locations:** "The card feed module lives at `modules/custom/bravo_cards`."
- **Architectural relationships:** "Module X depends on service Y."

**Map nodes can be extracted from either `[USER]:` or `[AGENT]:` turns.** Sometimes the agent surfaces a module name or file location during exploration that's worth recording. Both roles are valid sources.

---

## What you are NOT looking for

Most of the transcript is not knowledge. Do not capture:

- Code the agent wrote that the user accepted without correction.
- Bug fixes for typos, syntax errors, or generic mistakes ("you have a typo in line 4" is not knowledge).
- File reads, `ls`, `grep`, or exploration steps the agent took to orient.
- Routine method implementations that the user accepted as-is.
- General programming knowledge (how to write a getter, what dependency injection is, how HTTP works).
- Restatements of standard framework behavior that anyone reading the docs would know.
- Anything that could be re-derived by reading the codebase.

The signal for capture is: **did the user have to teach the agent something the agent couldn't have known from the codebase or from general knowledge? Or did the user introduce a named thing that didn't exist in the project's vocabulary before?** Everything else is noise. When in doubt, skip.

---

## Ownership boundary between the two passes

A single user statement can contain both kinds of content. Split them:

> "Use the bravo_analytics dispatcher for tracking — it's a service we built so we can swap backends without rewriting every module."

This has:
- A practice node: "Use the bravo_analytics dispatcher for all event tracking (rationale: swappable backends)."
- A map node: "bravo_analytics.dispatcher — service that fans out tracking events to whatever backend is currently wired in."

Practice owns the imperative knowledge (do/don't/why). Map owns the named entity (what it is). They reference each other later via `relates_to` populated by the curator; you do not need to populate `relates_to` in your output.

---

## Inline example

Here is a small example transcript and the correct output, so you know exactly what's expected.

**Input transcript:**

```
[USER]: Let's add caching to the user profile page. Use Drupal's render cache.
[AGENT]: I'll add #cache properties with appropriate contexts and tags.
[USER]: No, don't use the default render cache for profile pages. We have a custom cache backend for anything with PII — the service is bravo_pii.cache. It encrypts at rest. Default Drupal cache stores plaintext in the database and we got dinged on that during the GDPR audit.
[AGENT]: Got it. I'll use bravo_pii.cache instead.
```

**Correct output:**

```json
{
  "practice": [
    {
      "kind": "practice",
      "tags": ["caching", "pii", "gdpr", "drupal"],
      "title": "Use bravo_pii.cache for any content with PII",
      "summary": "Don't use Drupal's default render cache for PII-bearing pages; use bravo_pii.cache (encrypts at rest).",
      "body": "For pages that render personally-identifiable information, the default Drupal render cache is not acceptable because it stores plaintext in the database. Use the `bravo_pii.cache` service instead — it encrypts at rest. This was flagged during the GDPR audit.\n\nApplies to: any route or render array that includes user-identifying data.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    }
  ],
  "map": [
    {
      "kind": "map",
      "tags": ["service", "caching", "pii"],
      "title": "bravo_pii.cache — encrypted cache backend for PII",
      "summary": "Custom Drupal cache backend service that encrypts at rest; used wherever content includes user PII.",
      "body": "`bravo_pii.cache` is a custom cache backend service. It encrypts cached entries at rest, unlike Drupal's default render cache which stores plaintext in the database. Adopted in response to a GDPR audit finding.",
      "confidence": "high",
      "supports_existing_node": null,
      "contradicts_existing_node": null
    }
  ]
}
```

Notice what the example does NOT capture:
- The agent's initial mention of "#cache properties" — that's just standard Drupal knowledge, not project-specific.
- The agent's "Got it" acknowledgment — paraphrasing isn't a teaching moment.

---

## Output schema

You must produce exactly one JSON object as your final output. It has two keys: `practice` and `map`, each an array of zero or more candidate nodes.

Each candidate has these required fields:

- `kind`: `"practice"` or `"map"` (must match the array it's in).
- `tags`: array of 1-5 short lowercase tags. Prefer existing tag conventions if visible from the transcript.
- `title`: short imperative (for practice) or noun phrase (for map). Max ~80 characters.
- `summary`: max 140 characters. This is what shows up in the KB index.
- `body`: markdown explaining the knowledge. Include rationale when present in the source ("because…", "since…"). Keep concise — 1-4 short paragraphs is typical.
- `confidence`: `"low"`, `"medium"`, or `"high"`. Use `"high"` when the user stated it explicitly with rationale; `"medium"` when the user stated it without rationale; `"low"` when you're inferring from context.
- `supports_existing_node`: always `null` in your output (the curator populates this later).
- `contradicts_existing_node`: always `null` in your output (the curator populates this later).

Either array may be empty. Many sessions produce zero of one kind or both — that's expected and correct. **Producing nothing is better than producing low-signal noise.**

---

## Final instructions

1. Read the transcript carefully.
2. For each `[USER]:` turn, ask: is the user teaching the agent something project-specific, or stating a project convention/prohibition/rationale? If yes, that's a practice candidate.
3. For each `[USER]:` or `[AGENT]:` turn, ask: does this introduce a named entity, feature, module, file location, or vocabulary term that someone unfamiliar with the project wouldn't know? If yes, that's a map candidate.
4. Apply the ownership boundary: split combined statements into a practice piece and a map piece.
5. Reject anything that fails the "could be derived from the codebase or general knowledge" test.
6. Emit one final JSON object matching the schema above. No prose before or after the JSON.

The transcript begins below.

---

[TRANSCRIPT PLACEHOLDER — substituted at runtime]
