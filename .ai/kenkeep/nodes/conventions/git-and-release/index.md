# kenkeep Index: conventions / git-and-release

↑ Parent: [conventions](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Never force push**](practice-never-force-push.md) to learn about: Force pushing rewrites remote history and can lose collaborators' work. #git #conventions
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) to learn about: Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output. #ci #llm #workflow
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) to learn about: In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH. #git #github #gh #authentication #remote #push #environment
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) to learn about: semantic-release automates releases on merge to main; commit type (feat/fix/etc.) sets the version bump; no manual tag or npm publish. #git #release #conventional-commits
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) to learn about: All node changes are reviewed via git diff: accept with git commit, reject with git restore. Same for curator and bootstrap output. #review #git #workflow

## Components (what exists)
_None yet._

## By topic

### #git
- Open [**Never force push**](practice-never-force-push.md) — Force pushing rewrites remote history and can lose collaborators' work.
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — semantic-release automates releases on merge to main; commit type (feat/fix/etc.) sets the version bump; no manual tag or npm publish.
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff: accept with git commit, reject with git restore. Same for curator and bootstrap output.
### #workflow
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff: accept with git commit, reject with git restore. Same for curator and bootstrap output.
### #authentication
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #ci
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
### #conventional-commits
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — semantic-release automates releases on merge to main; commit type (feat/fix/etc.) sets the version bump; no manual tag or npm publish.
### #conventions
- Open [**Never force push**](practice-never-force-push.md) — Force pushing rewrites remote history and can lose collaborators' work.
### #environment
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #gh
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #github
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #llm
- Open [**Don't run curate or bootstrap-incremental in CI**](practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**LLM-backed migrations require explicit --harness flag**](../../harnesses/cross-harness/practice-llm-backed-migrations-require-explicit-harness-flag.md) — Migrations that cluster nodes with an LLM must fail fast if the user did not pass --harness explicitly.
- Open [**kk-proposal-drain (extraction hook)**](../../hooks/map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #push
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #release
- Open [**Conventional Commits drive semantic-release**](practice-conventional-commits-and-release.md) — semantic-release automates releases on merge to main; commit type (feat/fix/etc.) sets the version bump; no manual tag or npm publish.
### #remote
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #review
- Open [**Review node changes via git**](practice-review-nodes-via-git.md) — All node changes are reviewed via git diff: accept with git commit, reject with git restore. Same for curator and bootstrap output.