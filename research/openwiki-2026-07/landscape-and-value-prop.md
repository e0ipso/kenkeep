# AI Coding Memory & Repo-Knowledge Landscape — mid-2026

Strategic analysis for **kenkeep** (git-native, human-curated, team-shared knowledge base built from AI coding sessions; npm package; multi-harness: Claude Code, Codex CLI, Cursor, OpenCode, Copilot CLI; no daemons, no DB, no API keys).

---

## 1. The tools

The space has split into three families that are often lumped together but solve different problems:

- **A. Session/agent memory** — capture what the agent did, recall it later. (claude-mem, MemPalace, mem0, Letta, ByteRover, Cline Memory Bank, Claude Code auto-memory, Cursor memories)
- **B. Code-derived documentation** — read the source, generate a wiki. (OpenWiki, DeepWiki)
- **C. Curated tribal knowledge** — distill durable, reviewed facts from sessions into a shared, versioned base. (**kenkeep**; ByteRover partially)

kenkeep sits in **C**, closest in mechanics to A (session-derived) but closest in intent to B (a durable, shared artifact) — while being the only one that is simultaneously human-curated, git-reviewed, zero-infra, no-key, and genuinely multi-harness.

### kenkeep (the subject)
- **Source:** durable knowledge distilled from AI coding sessions (conventions, gotchas, named modules, decision rationale).
- **Storage:** plain markdown in git, one node per fact, under `.ai/kenkeep/nodes/`; a conformant Open Knowledge Format (OKF v0.1) bundle. Tree-over-DAG with generated index nodes and progressive-disclosure retrieval. **No DB, no vectors, no embeddings.**
- **Team vs per-user:** committed team artifact; per-user state (`_sessions/`, `_logs/`, `.state/`) is gitignored.
- **Curation:** human-in-the-loop. Nothing enters the base without `/kk-curate` (LLM drafts) + `git commit` (human accepts) / `git restore` (rejects). Contradictions surface as conflict files the human resolves; the curator never auto-resolves.
- **Infra:** none. One-shot CLI + host-harness hooks. No daemons/services/Docker.
- **API keys:** none. Runs inside whatever assistant subscription you already pay for.
- **Harness coverage:** Claude Code, Codex CLI, Cursor, OpenCode, Copilot CLI (5). Prompt-time injection wired for Claude + Codex today.
- **Retrieval/injection:** deterministic. SessionStart injects the root `ENTRY.md` catalog; agent descends by relevance (progressive disclosure). Optional prompt-time hook injects lexically-ranked leaf summaries. No LLM, no store at retrieval time.
- **Signals:** small/early npm package (`kenkeep`), single-maintainer (e0ipso / Lullabot orbit), actively developed; ships knowledge packs for shared framework/domain trees.

### OpenWiki (LangChain)
- **Source:** the **codebase** — reads source and generates wiki-style docs.
- **Storage:** markdown in the repo under `openwiki/`; committed to git. Config/keys in `~/.openwiki/.env`.
- **Team vs per-user:** the wiki is a committed team artifact; runs per-developer or via CI.
- **Curation:** **automatic** — an agent generates/refreshes docs; a GitHub Action opens a **daily PR** with updates. Human review is the PR merge, but content is machine-authored end-to-end.
- **Infra:** CLI + optional GitHub Action. No DB.
- **API keys:** **required.** Configure an inference provider + key (OpenRouter, Fireworks, Baseten, OpenAI, Anthropic; GLM 5.2 / Kimi K2.6 / Sonnet 5, custom model IDs). Optional LangSmith key for tracing.
- **Harness coverage:** harness-agnostic rather than multi-harness — it is its own CLI/agent and *appends pointers to* `AGENTS.md`/`CLAUDE.md` so any coding agent references the generated wiki. Not a plugin into 5 harnesses.
- **Retrieval/injection:** indirect — the agent reads the `openwiki/` markdown via the pointer added to AGENTS.md/CLAUDE.md.
- **Signals:** ~4.9k stars, ~360 forks; backed by LangChain (langchain-ai org).

### claude-mem
- **Source:** everything the agent does — tool observations captured live via 5 hooks (SessionStart, PostToolUse, Stop, UserPromptSubmit, SessionEnd), AI-compressed into semantic summaries.
- **Storage:** local store with a background worker service; HTTP API on **port 37777**. DB/index-backed, not plain reviewable markdown.
- **Team vs per-user:** **per-user / per-machine** (local observations).
- **Curation:** **automatic**, no human review — observer agent records and injects the relevant slice next session.
- **Infra:** background worker/daemon + local HTTP service. (Feb 2026 community audit rated it HIGH risk: the port-37777 API has no auth, so any local process can read stored observations/settings.)
- **API keys:** none separate (uses the harness/subscription for compression).
- **Harness coverage:** broad plugin — Claude Code, Gemini CLI, Codex, OpenCode, OpenClaw, Copilot.
- **Retrieval/injection:** automatic context injection of the relevant compressed slice at session start.
- **Signals:** very popular — ~84k stars, 7.2k forks, 288 releases, v13.8.0 (Jun 2026). The runaway leader by mindshare in family A.

### MemPalace
- **Source:** conversation history stored **verbatim** (no summarize/extract/paraphrase); human "mining" chooses what to file.
- **Storage:** vector — ChromaDB default (+ SQLite exact), optional Qdrant/pgvector. Hierarchical temporal structure (Wings > Rooms > Closets > Drawers).
- **Team vs per-user:** **local per-user** ("nothing leaves your machine unless you opt in").
- **Curation:** human decides what gets mined in; **retrieval is automated semantic search**, not editorially reviewed. Verbatim, not distilled.
- **Infra:** local vector DB (ChromaDB/SQLite); optional external backends.
- **API keys:** none for core (zero API calls; runs local embeddings).
- **Harness coverage:** Claude Code, Cursor, Gemini CLI via hooks + MCP.
- **Retrieval/injection:** vector semantic search, ~170 tokens to recall; MCP-exposed. Tops LongMemEval among free tools (96.6% raw).
- **Signals:** viral — ~57k stars, 7.4k forks; MIT. Launched Apr 2026 (Milla Jovovich + Ben Sigman).

### DeepWiki (Cognition)
- **Source:** the **codebase** — Devin-generated docs (architecture diagrams, module explanations, dependency maps) for any public GitHub repo.
- **Storage:** **hosted by Cognition** — not in your repo, not local. Swap `github.com` → `deepwiki.com`.
- **Team vs per-user:** public/shared hosted docs; free for open source. Private repos via paid.
- **Curation:** fully automatic; conversational Q&A grounded in source.
- **Infra:** none for you (it's a SaaS); an official MCP server at `mcp.deepwiki.com` exposes it to agents.
- **API keys:** none for public use.
- **Harness coverage:** any MCP client (Claude Code, Cursor, etc.) via the MCP server.
- **Signals:** ~50k+ repos indexed; backed by Cognition (Devin).

### Claude Code — native memory (CLAUDE.md + auto-memory)
- **Source:** persistent instructions (hand-written CLAUDE.md) **plus auto-memory** — Claude autonomously writes useful learnings (build commands, gotchas, style, workflow) back to CLAUDE.md across sessions.
- **Storage:** plain markdown (CLAUDE.md) in git — same medium as kenkeep.
- **Team vs per-user:** project CLAUDE.md is committable/team-shared; auto-memory writes are effectively per-user until committed and can bloat a single file.
- **Curation:** auto-memory is **automatic** and **on by default** (v2.1.59+); the human only reviews if they happen to diff CLAUDE.md.
- **Infra / keys:** none (built into the harness).
- **Harness coverage:** **Claude Code only.**
- **Retrieval:** whole file read at session start (no progressive disclosure; scales poorly as it grows).
- **This is the single biggest commoditization threat to kenkeep's mechanics** (see §3).

### Cursor — rules + memories
- **Source:** memories auto-generated from chat, scoped to project; plus `.cursor/rules`.
- **Storage:** memories in Cursor's own store (per-user/per-project); rules as files in-repo.
- **Team vs per-user:** memories are per-user; the **Business plan ($40/user/mo)** adds a team marketplace for shared rules/skills and org-wide standards.
- **Curation:** memories automatic; rules hand-authored.
- **Infra/keys:** none extra (in-product).
- **Harness coverage:** **Cursor only** (editor + its CLI share one bank).

### mem0 / Letta / ByteRover / Cline Memory Bank (family A, briefly)
- **mem0:** vector-DB memory layer/SDK for agents; automatic extraction; needs infra + keys; ~51k stars, $24M raised. Framework, not a curated repo artifact.
- **Letta (ex-MemGPT):** OS-style stateful-agent framework (main context = RAM, archival = disk); DB-backed; ~13k stars; self-hosted control. Agent-autonomy focused.
- **ByteRover:** the closest philosophical cousin outside kenkeep — a **git-like, curated, version-controlled "context tree"** synced across teammates, provider-agnostic CLI (20 providers), works with any agent. Differs from kenkeep: it's a separate memory layer/product (not zero-infra plain-markdown-in-your-repo), leans on its own structured store, and is a standalone tool rather than harness-native hooks.
- **Cline Memory Bank:** a markdown documentation *methodology* (structured .md files in-repo) that Cline reads to survive context-window clears. In-repo markdown like kenkeep, but Cline-specific, manually structured, and not session-distilled/curated with a review gate.

---

## 2. Feature-set comparison table

| Dimension | **kenkeep** | **OpenWiki** | **claude-mem** | **MemPalace** | **DeepWiki** | **CC auto-memory** |
|---|---|---|---|---|---|---|
| Knowledge source | Sessions -> distilled facts | **Code** -> docs | Sessions (tool obs) | Sessions (verbatim) | **Code** -> docs | Sessions (autonomous) |
| Storage | Markdown in git (OKF) | Markdown in git | Local DB + worker | Vector DB (Chroma/SQLite) | **Hosted SaaS** | Markdown (CLAUDE.md) |
| Curation | **Human-reviewed** (commit/restore) | Automatic (daily PR) | Automatic | Human-mine / auto-retrieve | Automatic | Automatic (default on) |
| Team-shared | **Yes (git)** | Yes (git) | No (per-user) | No (per-user) | Public hosted | Partial (commit CLAUDE.md) |
| Multi-harness | **Yes (5, native hooks)** | Agnostic (pointer file) | Yes (6, plugin) | Yes (3, hooks/MCP) | Any MCP client | **Claude only** |
| Infra | **None** | CLI + Action | Daemon + HTTP:37777 | Vector DB | None (SaaS) | None |
| API keys | **None** | **Required** | None | None | None | None |
| Review workflow | **git diff / PR per fact** | PR (machine-authored) | None | None | None | None (diff if noticed) |
| Retrieval/injection | Deterministic progressive disclosure + lexical prompt-time; no LLM/vectors | Agent reads openwiki/ via pointer | Auto-inject compressed slice | Vector semantic (MCP) | MCP Q&A | Whole-file read at start |
| Popularity | Early/small | ~4.9k stars | ~84k stars | ~57k stars | 50k+ repos | Built-in |

---

## 3. kenkeep vs OpenWiki — value props (crisp)

**They answer different questions.**

- **OpenWiki answers "what is this code?"** — it derives *documentation* from *source*. Ground truth is the tree; output is architecture/module/dependency description. It is automatic, exhaustive, and machine-authored, refreshed on a schedule.
- **kenkeep answers "what do we know about working here that the code doesn't say?"** — it derives *tribal knowledge* from *sessions*. Ground truth is human experience: the gotcha that cost someone an afternoon, the rationale behind an odd choice, the convention that isn't enforced anywhere. This is exactly the knowledge that is **not** recoverable from source, which is why OpenWiki structurally cannot produce it.

**Curation philosophy is the sharpest contrast.** OpenWiki trusts the model to write docs and asks a human to merge a PR. kenkeep distrusts the model by design: the constitution forbids anything entering the base without an explicit human `git commit`, and forbids the curator from auto-resolving contradictions. OpenWiki optimizes for *coverage*; kenkeep optimizes for *trust and signal*.

**Other axes:** OpenWiki **requires an API key** and an inference provider; kenkeep requires **neither** (runs on the subscription in the harness). OpenWiki is effectively single-tool + a pointer file; kenkeep natively targets 5 harnesses. Both store markdown in git — so both are reviewable and travel with `git pull`.

**Overlap:** both produce a committed markdown knowledge artifact that agents consult; both improve session context without a hosted DB. A team could reasonably run one and feel "covered."

**Complementary, not competitive.** The ideal setup runs **both**: OpenWiki keeps the *structural map* of the code fresh automatically (cheap to regenerate, tolerant of being machine-authored because it's checkable against source), while kenkeep accumulates the *experiential layer* that only humans can validate (expensive to get wrong, so gated on review). One is breadth-from-code; the other is depth-from-experience. They even share the injection surface — OpenWiki appends to AGENTS.md/CLAUDE.md; kenkeep injects its ENTRY.md — and don't collide.

---

## 4. Is kenkeep worth maintaining? — honest verdict

**Verdict: Yes, conditionally — it occupies a real and currently unoccupied niche, but its moat is narrow and one native feature (Claude Code auto-memory) is already eroding the easy version of its value. It is worth maintaining *if and only if* the team leans hard into the four properties no competitor combines, and treats "team-reviewed shared knowledge" — not "session memory" — as the product.**

### The defensible niche (be specific)
No other tool in this landscape is **all four** of:
1. **Team-shared** as a first-class git artifact (claude-mem, MemPalace, mem0, Letta, Cursor memories, CC auto-memory are all per-user/per-machine or paywalled-team).
2. **Human-reviewed with a hard gate** — nothing lands without a `git commit`; contradictions never auto-resolve (everyone else is automatic; OpenWiki's "review" is merging machine-authored bulk).
3. **Genuinely multi-harness via native hooks** across 5 tools (native memories lock you to one vendor; OpenWiki is agnostic-but-single-tool).
4. **Zero-infra and zero-API-key** (no daemon like claude-mem's port 37777, no vector DB like MemPalace/mem0, no SaaS like DeepWiki, no separate provider key like OpenWiki).

The intersection of {shared + reviewed + multi-harness + zero-infra + no-key} is **kenkeep alone**. The nearest competitor is ByteRover (git-like curated context tree, team-synced, multi-provider) — but it's a heavier standalone product with its own store, not plain markdown living in your repo with no infra. That gap is kenkeep's real, differentiated territory: the **compliance/enterprise-friendly, trust-first, vendor-neutral** corner of the market — teams that cannot or will not run a daemon, ship data to a SaaS, hold another API key, or let a model write to their knowledge base unreviewed.

### What threatens it
- **Native harness memory commoditizing the mechanic.** Claude Code **auto-memory is on by default** and writes learnings to CLAUDE.md (markdown in git) autonomously. For a Claude-only shop, that covers the 60% case for free with zero adoption cost. This is the primary threat: it makes "salvage knowledge from sessions and inject it back" a checkbox, not a product.
- **Mindshare asymmetry.** claude-mem (~84k stars) and MemPalace (~57k stars) dominate attention. Even though they solve a *different* (per-user, automatic, unreviewed) problem, they define what "AI memory" means to most developers, and kenkeep must constantly re-explain that it is not that.
- **Cursor/vendor team tiers.** Cursor's Business plan already sells shared rules/skills org-wide; vendors are moving toward org-knowledge bases. If Anthropic/Cursor ship *reviewed, shared, multi-project* memory, they compress kenkeep's niche from the top.
- **"Good enough" substitution.** A team could run OpenWiki (auto docs) + rely on auto-memory and never feel the specific pain kenkeep removes.

### Why the threats don't (yet) close the niche
- Auto-memory is **single-vendor, unreviewed, and per-user-flavored**, and dumps into one growing file with no progressive disclosure — it degrades at team scale and offers no trust gate. kenkeep's OKF tree + review gate + multi-harness reach are exactly the things native memory omits.
- claude-mem/MemPalace/mem0 are **explicitly per-user and automatic** — structurally the opposite of a curated team artifact. They cannot become kenkeep without abandoning their design (local, verbatim/compressed, no review).
- The **no-daemon / no-key / no-SaaS** posture is a hard requirement in regulated and security-conscious orgs; claude-mem's unauthenticated port-37777 and DeepWiki's hosting are non-starters there. kenkeep is one of the few that clears that bar.

### Conditions under which it stops being worth maintaining
1. **Anthropic (or Cursor) ships reviewed, team-shared, multi-project memory** with a diff/approve gate — that would absorb the niche wholesale for that vendor's users. (Multi-harness neutrality would still be a residual reason to exist, but a shrinking one.)
2. **Auto-memory adds a review/curation gate and progressive disclosure** and a team-commit story — collapsing kenkeep's differentiation for the dominant harness.
3. **The maintenance cost outruns the user base.** It's effectively single-maintainer against 5 moving harness targets (hook APIs, event names, transcript formats all drift). If harness churn makes the multi-harness promise a treadmill while adoption stays flat, the ROI inverts.
4. **The "human-reviewed" value fails to convert** — i.e., in practice teams find automatic memory's occasional wrongness tolerable and won't pay the curation tax. If the market votes for convenience over trust at scale, kenkeep's core bet is wrong.

### Bottom line
kenkeep is worth maintaining as a **deliberately narrow, principled tool for teams that treat their knowledge base like code**: reviewed, versioned, vendor-neutral, and infra-free. Its differentiation is real and, as of mid-2026, uncontested in combination. But it is a **niche, not a market** — the strategy should be to double down on the review-gate + team-sharing + zero-infra + multi-harness story (and assets like knowledge packs and OKF conformance that native memory can't match), explicitly *ceding* the per-user automatic-recall use case to claude-mem/MemPalace rather than competing there. The moment a major vendor ships *reviewed, shared* memory, reassess hard.
