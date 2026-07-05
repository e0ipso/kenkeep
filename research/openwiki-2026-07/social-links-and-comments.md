# OpenWiki social links + kenkeep comment drafts

**Research date:** 2026-07-05. OpenWiki launched by LangChain ~July 1, 2026. All URLs below were surfaced by live web search and are real. Reddit could **not** be verified (reddit.com was blocked from the search tool) — no link was fabricated. GitHub Discussions is **not enabled** on langchain-ai/openwiki (the `/discussions` URL 404s).

**Framing used in every draft:** OpenWiki documents *the code itself* (agent derives/maintains a wiki from source). kenkeep captures *tribal knowledge from AI sessions* — conventions, gotchas, rationale — with a **human review gate in git**. Complementary, not competitors: OpenWiki = the "what," kenkeep = the "why / watch-out."

## Overall recommendation (per platform)

- **X/Twitter — best ROI, lowest risk.** Short replies are normal. **Highest-value target is Harrison Chase's "What do you want in your wiki?" post** — he's literally soliciting input.
- **Hacker News — comment once, carefully.** Thread is skeptical about staleness and "who curates" — that's kenkeep's exact wedge. Lead with the substantive point, disclose, mention kenkeep once, no link-first, no reply-bombing.
- **LinkedIn — fine, polished, low frequency.** Comment on the official post + one reshare max (don't paste the same comment across every reshare).
- **Medium "Stop stuffing CLAUDE.md" article — strong fit** (kenkeep also argues against monolithic CLAUDE.md).
- **Reddit — unverified.** If you find a live thread manually, comment inside it with disclosure; never start a promo thread. Fallback draft at the bottom.
- **DO NOT comment on:** aggregator/SEO blogs (aitechpartner, themenonlab, youmind, digg) — auto-generated, no real audience, pure spam signal. Don't open a GitHub **issue** on openwiki to promote kenkeep. Don't repeat the same comment across LinkedIn reshares.

## Links + suggested comments

### 1. Hacker News — Show/launch thread

- **Link:** https://news.ycombinator.com/item?id=48752949
- **Context:** by `handfuloflight`, ~Jul 1–2, ~64 pts / ~17 comments. Skeptical tone: wikis go stale, "who curates," "over-engineered vs a good prompt."
- **Suggested comment:**

> The "wikis go stale / who actually curates this" worry here matches what we kept hitting. Auto-generated repo docs describe *what the code is* well, but can't capture what never lands in source: why an abstraction exists, the gotcha that cost someone a day. That lives in AI-session transcripts and evaporates when the session ends. Disclosure: I maintain kenkeep (open source), the complementary half — it distills durable facts *out of your AI sessions*, and nothing enters the base without a human approving it as an ordinary git diff. So "who curates it" = a person, in a PR, with full history/blame/revert. The failure mode you're describing is mostly the *unreviewed* auto-update loop, not docs themselves.

### 2. X — LangChain official launch post

- **Link:** https://x.com/LangChain/status/2072376975545798792
- **Suggested comment:**

> Nice — the agent-consumable docs angle is right. We've been on the other half: OpenWiki derives docs from code; kenkeep (disclosure: I maintain it) captures tribal knowledge from AI sessions — conventions, gotchas, rationale — with a human review step in git. Pair them and the agent gets the "what" and the "why." Congrats on the launch.

### 3. X — Harrison Chase, launch commentary

- **Link:** https://x.com/hwchase17/status/2072375664314081287 ("wikis for memory are all the rage")
- **Suggested comment:**

> "Wikis for memory" is the right frame. The bit I'd add: some memory shouldn't be auto-written — the conventions/gotchas an agent learns mid-session need a human to bless them before they're team truth. That's kenkeep's niche (disclosure: I build it) — human-curated session knowledge in git, complementary to auto-derived repo docs.

### 4. X — Harrison Chase, "what do you want in your wiki?" ⭐ HIGHEST PRIORITY

- **Link:** https://x.com/hwchase17/status/2072532749374898176
- **Context:** Open solicitation for input — the single best place to engage.
- **Suggested comment:**

> One source I'd love in the mix: the AI coding sessions themselves. Half the durable knowledge ("why we did X", "watch out for Y") is stated in chat and never makes it into code, so a code-derived wiki can't see it. A capture-from-transcripts source + a human review gate before commit would be huge. (Disclosure: that's basically what I built kenkeep to do — happy to compare notes on structure/curation.)

### 5. X — Micha Bladowski (@michabbb)

- **Link:** https://x.com/michabbb/status/2072457248887259175
- **Context:** dev sharing install steps.
- **Suggested comment:**

> Good writeup. Complementary piece: capturing what your AI *sessions* learn (conventions, gotchas) into git with a human review step — that's kenkeep (I maintain it). OpenWiki = docs from code, kenkeep = reviewed memory from sessions. They stack.

### 6. LinkedIn — LangChain official

- **Link:** https://www.linkedin.com/posts/langchain_openwiki-can-generate-repo-docs-automatically-activity-7478159637293318144-5QZ3
- **Suggested comment:**

> Really like the "docs built for agents, kept fresh automatically" framing — drift is a real tax. One complementary layer: a lot of a repo's most valuable knowledge (why an approach was chosen, the non-obvious gotcha) is generated in AI sessions and never lands in source, so a code-derived wiki can't capture it. Disclosure: I maintain kenkeep, open source, which distills that session knowledge into human-reviewed, git-versioned notes — complementary to OpenWiki, not an alternative. Congrats to the team.

### 7. LinkedIn — Sanket Prabhu (#agent #SDLC reshare)

- **Link:** https://www.linkedin.com/posts/sanprabhu_openwiki-agent-sdlc-activity-7478295838939697152-Qf7h
- **Suggested comment** *(pick #7 OR #8, not both)*:

> The SDLC framing is spot on. Worth distinguishing two kinds of agent context: code-derived docs (OpenWiki) and the tacit decisions/gotchas that surface during AI work and otherwise evaporate. For the second, human-in-the-loop capture landing as reviewed git artifacts keeps it trustworthy. Disclosure: I build kenkeep, which targets that second bucket — complementary to code-doc tools like OpenWiki.

### 8. LinkedIn — Divya Pratap Singh Bhadoria (dev-tools reshare)

- **Link:** https://www.linkedin.com/posts/iamdivyapratap_ai-developertools-langchain-activity-7478191401856495616-n1p4
- **Suggested comment** *(pick #7 OR #8, not both)*:

> Good pick for the dev-tools feed. Mental model I've landed on: OpenWiki = auto-maintained docs *from* the code; the missing half is the tribal knowledge your AI sessions produce. Disclosure: I maintain kenkeep, which captures that with a human review gate in git. Together they cover the "what" and the "why."

### 9. Medium — "Stop Stuffing Your Repo Into CLAUDE.md" (Kristopher Dunham)

- **Link:** https://medium.com/@creativeaininja/stop-stuffing-your-repo-into-claude-md-openwiki-has-a-better-pattern-817affd4bd0b
- **Context:** has a comment section; argument aligns with kenkeep's anti-monolithic-CLAUDE.md stance.
- **Suggested comment:**

> Strong agreement on "don't stuff everything into CLAUDE.md" — it blows the context budget and mixes code facts with human decisions that need different handling. OpenWiki nails the first. The piece I'd add is the human-decision half — conventions/gotchas from actual AI sessions. Disclosure: I maintain kenkeep, which captures those into small per-fact markdown nodes with a human review step and progressive disclosure (agent loads an index, descends only into what's relevant), so the payload stays small as it grows. Complementary to OpenWiki, not competing.

## Reference-only (do not comment)

- LangChain blog: https://www.langchain.com/blog/introducing-openwiki-an-open-source-agent-for-repo-documentation (no comment section)
- GitHub repo: https://github.com/langchain-ai/openwiki (Discussions disabled — don't self-promo via issues)
- Trendshift: https://trendshift.io/repositories/70339

## Reddit fallback draft

Only if you locate a real thread manually; never as a new post:

> Been using OpenWiki-style code docs alongside something that captures the *session* side — the conventions/gotchas that come up while pairing with an agent and otherwise vanish. Full disclosure, that second thing is my project (kenkeep, open source): distills durable facts out of AI sessions into git with a human review step. OpenWiki does the code map, this does the "why/watch-out." They stack. Happy to answer Qs.
