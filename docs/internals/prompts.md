---
title: Prompts
parent: Internals
nav_order: 4
---

# Customizing prompts

The KB's LLM work runs in two places:

1. The **proposal-drain hook** spawns a headless `claude -p` to convert each captured session log into a structured proposal. It loads its prompt from a local override path, falling back to the bundled template — edit the file under `.ai/knowledge-base/.config/prompts/proposal-extract.md` to customize, delete it to revert.
2. The **kb-bootstrap, kb-curate, and kb-add skills** run inside the host harness session (launched via `<harness> -p "/kb-<name>"` or invoked directly from a session). Their prompts live with the skill, not in a separate prompt file: edit `.claude/skills/kb-<name>/SKILL.md` (and the equivalent under `.codex/`, `.cursor/`, `.opencode/`) to customize.

Bump the top-of-file `Version: N` comment on every behavior change; logs record the prompt content so historic decisions stay auditable.

## Where each prompt lives

- **`proposal-extract.md`** (v2 in the bundled template): drives the async proposal-drain hook to convert a redacted transcript into structured practice and map candidates. Spawned by `kb-proposal-drain` as a `claude -p` subprocess.
- **`kb-curate/SKILL.md`**: the curate skill's canonical prompt. Reads pending session logs, drafts add/modify/contradict/drop actions in-session, hands the merged set to `curate-dedup`, walks contradictions with the user. There is no separate `curator.md` prompt file anymore — the curator logic that used to be spawned as a sub-agent is now the skill prompt.
- **`kb-bootstrap/SKILL.md`**: the bootstrap skill's canonical prompt. Enumerates source markdown via `finddocs`, drafts node bodies inline, persists via `node write`. There is no separate `bootstrap-incremental.md` prompt file anymore.
- **`kb-add/SKILL.md`**: the manual-add skill's canonical prompt. Conversationally gathers fields, persists via `node write`.

| Surface | Source of truth | Local override |
|---|---|---|
| Proposal extraction | `templates/prompts/proposal-extract.md` | `.config/prompts/proposal-extract.md` |
| Curate skill | `src/templates-source/skills/kb-curate/SKILL.md` (regenerated into `.claude/skills/kb-curate/SKILL.md` etc.) | edit the per-harness copy directly |
| Bootstrap skill | `src/templates-source/skills/kb-bootstrap/SKILL.md` (regenerated similarly) | edit the per-harness copy directly |
| Manual-add skill | `src/templates-source/skills/kb-add/SKILL.md` (regenerated similarly) | edit the per-harness copy directly |

The skill source under `src/templates-source/skills/kb-<name>/SKILL.md` is the single canonical version; the per-harness copies (`.claude/skills/kb-<name>/`, `.opencode/skills/kb-<name>/`, etc.) are regenerated from it by the template-sync mechanism. Edit the per-harness copy when iterating in a consumer repo; edit the templates-source when contributing back to the package.

## Pipeline overview

The KB's prompts form the knowledge-acquisition pipeline. Two extractors emit candidate nodes — the **proposal extractor** (the `proposal-extract.md` prompt, spawned as a `claude -p` subprocess by the proposal-drain hook) for live sessions, and the **bootstrap skill** (`kb-bootstrap/SKILL.md`, running in the host harness session) for existing docs. The **curator skill** (`kb-curate/SKILL.md`, also running in the host harness session) decides what becomes a file on disk. The diagram below shows the gates, filters, and decisions inside each prompt.

```mermaid
flowchart TB
    subgraph proposal["Proposal extraction · proposal-extract.md v4"]
        direction TB
        PI["Redacted transcript<br/>role-tagged USER / AGENT segments"]
        PG{"Session-disposition gate<br/>abandoned · exploratory<br/>unrelated · meta-only?"}
        PEMPTY["Empty proposal<br/>practice=[], map=[]"]
        PP1["Practice pass<br/>USER turns + self-review-apply<br/>(incl. corrective patterns)"]
        PP2["Map pass<br/>USER or AGENT turns"]
        PF2{"Task-specific scope?<br/>one-off names · 'in this PR'<br/>this file / this function"}
        PF3{"End-state framing?<br/>present tense<br/>no transition narrative"}
        PO["Practice + Map candidates<br/>tags · title · summary · body · confidence"]

        PI --> PG
        PG -- "non-productive" --> PEMPTY
        PG -- "productive" --> PP1
        PG -- "productive" --> PP2
        PP1 --> PF2
        PF2 -- "yes → drop" --> PEMPTY
        PF2 -- "no" --> PF3
        PP2 --> PF3
        PF3 -- "no → drop" --> PEMPTY
        PF3 -- "yes" --> PO
    end

    subgraph bootstrap["Bootstrap skill · kb-bootstrap/SKILL.md"]
        direction TB
        BI["One markdown doc<br/>=== FILE: path === ... === END FILE ==="]
        BS{"Skip filter<br/>API dumps · boilerplate<br/>generic framework · TODOs?"}
        BSKIP["Empty output"]
        BP1["Practice pass<br/>imperatives · rationale markers<br/>admonitions"]
        BP2["Map pass<br/>component headers · definitions<br/>file paths"]
        BC["Confidence calibration<br/>high: explicit + maintained<br/>medium: default<br/>low: draft/legacy/ambiguous"]
        BO["Practice + Map candidates"]

        BI --> BS
        BS -- "yes" --> BSKIP
        BS -- "no" --> BP1
        BS -- "no" --> BP2
        BP1 --> BC
        BP2 --> BC
        BC --> BO
    end

    subgraph curator["Curator skill · kb-curate/SKILL.md"]
        direction TB
        CI["Batch of candidates<br/>existing_nodes always empty<br/>(overlap judged from candidate framing)"]
        CG{"Non-productive<br/>provenance signals?<br/>hedged · hypothetical · plan-scoped"}
        CCF{"Change-oriented framing?<br/>'used to X, now Y' · rename · removal"}
        CSAL{"Clean end-state claim<br/>salvageable?"}
        COV{"Suspected overlap<br/>with existing KB node?"}
        CNEG{"Direct negation?<br/>(both cannot be true<br/>in the same scope)"}
        CEXT{"Extends without<br/>negating?"}

        CADD["add<br/>writes nodes/&lt;kind&gt;/&lt;slug&gt;.md"]
        CMOD["modify<br/>overwrites target node<br/>requires target_node_id on disk<br/>end-state rewrite rule"]
        CCON["contradict<br/>writes conflicts/&lt;id&gt;.md<br/>no node touched"]
        CDROP["drop<br/>(rationale recorded)"]

        CI --> CG
        CG -- "yes" --> CDROP
        CG -- "no" --> CCF
        CCF -- "yes" --> CSAL
        CSAL -- "no" --> CDROP
        CSAL -- "yes" --> COV
        CCF -- "no" --> COV
        COV -- "no" --> CADD
        COV -- "yes" --> CNEG
        CNEG -- "yes" --> CCON
        CNEG -- "no" --> CEXT
        CEXT -- "yes" --> CMOD
        CEXT -- "no, rephrase only" --> CDROP
    end

    PO --> CI
    BO --> CI
    CADD --> NODES[("nodes/practice/<br/>nodes/map/")]
    CMOD --> NODES
    CCON --> CONF[("conflicts/&lt;id&gt;.md")]
```

Read top to bottom: each extractor short-circuits to an empty output when its gate fires; surviving candidates land in the curator, which routes every candidate to exactly one of four actions. The two extractors never interact - the curator is the only stage that writes to `nodes/` or `conflicts/`.

## Proposal prompt

The biggest quality lever in capture. Controls what the extractor treats as worth remembering.

### Sections

1. **Version comment**.
2. **What to extract** - practice/map definitions, trigger phrases.
3. **What to skip** - typos, file reads, agent paraphrases, generic programming knowledge. Also: non-productive sessions (abandoned, exploratory, cursory, unrelated, meta-only) short-circuit to `{"practice": [], "map": []}` via the session-disposition gate at the top of the prompt; the gate fires when the session as a whole does not converge on durable knowledge.
4. **Ownership boundary** - how to split combined statements between practice and map.
5. **Inline example** - a worked transcript with expected JSON.
6. **Output schema** - must match `ProposalOutputSchema`.

The drain replaces `[TRANSCRIPT PLACEHOLDER, substituted at runtime]` with the redacted slice. If the placeholder is removed, the transcript is appended at the end.

### Calibration

Fixtures under `tests/fixtures/transcripts/`:

- `routine-zero/` - a session with no teaching moments. Correct output is empty.
- `bravo-insider/` - 4 practice + 3 map candidates. `expected.md` is the target.

Mocked tests pin the schema; only real `claude -p` reveals prompt quality. Run the fixtures with the real CLI before shipping changes.

### Schema

Output shape must match `ProposalOutputSchema` in `src/lib/schemas.ts`. New fields mean extending the Zod schema. Bump `schema_version` on rename, removal, or semantic change; new optional fields don't bump.

## Curator skill prompt

The kb-curate skill's `SKILL.md` decides what happens to every proposal candidate: add, modify, contradict, or drop. Runs in the host harness session. Second-biggest quality lever.

### Input

`[BATCH PLACEHOLDER]` is replaced with:

```json
{
  "existing_nodes": [
    { "id": "...", "title": "...", "kind": "practice", "tags": ["..."], "summary": "...", "body": "..." }
  ],
  "batch": [
    {
      "session_id": "...",
      "captured_at": "...",
      "derived_from": "session-<id>.md",
      "practice_candidates": [...],
      "map_candidates": [...]
    }
  ]
}
```

`existing_nodes` carries only nodes referenced by `supports_existing_node` / `contradicts_existing_node` in the batch. The curator is told to `drop` any candidate that appears to overlap an existing node not provided in `existing_nodes`, with a rationale naming the suspected overlap.

### Output

A single JSON array. Each element:

```json
{
  "action": "add | modify | contradict | drop",
  "candidate_origin": "<session_id>:<practice|map>:<index>",
  "target_node_id": "<id-or-null>",
  "proposed_node": { /* full node, or null for drop */ },
  "rationale": "...",
  "suggested_resolution": null
}
```

The skill applies actions via the deterministic `curate-dedup` and `node write` primitives:

- `add` → the skill calls `node write` to atomically write `nodes/<kind>/<id>.md`. If the file already exists, `node write` resolves the slug via `ensureUniqueId` (`<id>-2`, …); a true collision-after-resolution is reported as a failure.
- `modify` → the skill calls `node write` against the existing `nodes/<kind>/<target_node_id>.md`. If the target file doesn't exist, the skill records a `modify_missing_target` failure.
- `contradict` → the skill includes the action in the JSON it pipes to `curate-dedup`, which writes the conflict to `.ai/knowledge-base/conflicts/<id>.md` (with `status: pending`) and stamps the source session log. The skill then walks each conflict in-session with the user.
- `drop` is a no-op.

`suggested_resolution` is always emitted as `null`; resolution happens via the in-session walkthrough.

### Verifying

1. `npm test` — curate-dedup tests assert that add/modify proposals survive to the output JSON, contradict actions become conflict files under `conflicts/`, and slug-collision-after-resolution lands in the failure report.
2. Inspect the harness session transcript for the final proposal JSON the skill piped to `curate-dedup`.

### Anti-patterns

- Modifications that rephrase existing content (drop instead).
- Additions when a near-duplicate exists (modify instead).
- Suggesting a `suggested_resolution` value (it's ignored - the user picks via the kb-curate skill).
- Crossing the practice/map boundary.
- Change-oriented framing (transition narratives, migration stories, rename or removal logs): automatic drop regardless of confidence, unless a clean end-state claim can be salvaged.
- Non-productive provenance signatures: candidates whose framing carries hedged wording, references to hypothetical entities, plan-scoped or task-scoped wording, or low-confidence-without-rationale are dropped. The curator weighs these signals together (not any single one in isolation) and treats a combined signature as evidence the candidate originated from an abandoned, exploratory, cursory, unrelated, or meta-only session that slipped the extractor's session-disposition gate.

## Bootstrap skill prompt

Controls what the kb-bootstrap skill treats as candidates from your source docs. Runs in the host harness session — there is no separate `bootstrap-incremental.md` prompt file (deleted in the launcher refactor).

### Skill behavior

1. **Discovery** — call `finddocs --from <scope> --with-hashes` to enumerate candidate markdown.
2. **Per-doc loop** — for each surviving doc, `Read` it, decide whether it carries durable knowledge (skipping auto-generated reference, licenses, generic framework knowledge, aspirational TODOs), draft practice and map candidates inline, and persist via `node write --source-doc <relpath> --source-hash <sha256>` (which folds the hash into `bootstrap-state.json` in the same atomic transaction).
3. **Hash-aware skip** — before reading a doc, compare its `finddocs --with-hashes` digest against `bootstrap-state.json`. Skip on hit.
4. **Finalize** — call `index rebuild` to regenerate `INDEX.md` and `GRAPH.md`.
5. **Rules** — never invent facts, quote rationale verbatim, never overwrite an existing node.

### Calibration loop

1. Pick 3–5 representative docs.
2. `finddocs --from <subset>` to confirm scope.
3. Run `bootstrap --from <subset>`. Review proposals as they land in `nodes/`.
4. Note false positives and false negatives. Adjust the "what to extract" and "what to skip" sections of `src/templates-source/skills/kb-bootstrap/SKILL.md` (or the per-harness copy under `.claude/skills/kb-bootstrap/SKILL.md` for a consumer-side override).
5. Delete `bootstrap-state.json` and re-run.
6. Repeat until acceptance lands around 60–80%. Higher rates tend to drop true positives.

## Reading run logs

The proposal-drain hook still writes a stream-JSON trace per run; curate and bootstrap no longer do (their work is now part of the host harness session transcript, captured wherever the user already captures that).

### Proposal — `_logs/proposal/<session-id>__<ts>.jsonl`

| Line type | What it is |
|---|---|
| `system / init` | Records session id and resolved model. |
| `assistant` | Intermediate streamed turns. |
| `user` | Rare follow-ups. |
| `result` | Final message. Parsed as JSON, validated against `ProposalOutputSchema`. |

Common failures:

- **No final result** — `claude` was killed or timed out. Check timestamps. The drain writes `proposal_status: failed` and does not retry on its own; these failure modes do not heal on retry.
- **Schema mismatch** — model emitted extra prose or skipped a field. Inspect `result` text; tune the prompt if consistent.

To force re-extraction of a `failed` entry: set `proposal_status: pending` in the session log and clear `proposal_error`. The next drain sweep will pick it up.

### Curate / bootstrap

Curate and bootstrap no longer write `_logs/curator/*.jsonl` or `_logs/bootstrap-incremental/*.jsonl` — the work runs in the host harness session, and the harness's own transcript captures the reasoning. To inspect what the curate skill did on a given run, look at the host session's transcript (or, for the `curate-dedup` primitive's output, pass `--output <path>` to capture the surviving-actions JSON).

Common curate / bootstrap issues:

- **`nodesWritten: 0` despite a non-empty batch** — check the host session transcript for skill-reported failures (slug collision, `modify_missing_target`, or `add_collision`).
- **Conflict not surfacing in `/kb-curate`** — check `.ai/knowledge-base/conflicts/` for a file with `status: pending`. The skill walks from there.
- **Duplicates after dedup** — `curate-dedup` keeps the higher-confidence action per `proposed_node.id`. Duplicates mean inconsistent slugification produced different ids.

To re-run a single batch: clear `curator_processed_at` and `curator_run_id` from the affected session log and re-run `curate`.

### Privacy

Proposal logs contain the **redacted** transcript. Secrets secretlint caught are redacted; secrets it missed could appear. Treat `_logs/` with the same care as `_sessions/`. Both gitignored by default.
