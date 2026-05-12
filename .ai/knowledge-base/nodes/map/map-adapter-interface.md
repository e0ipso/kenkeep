---
schema_version: 1
id: map-adapter-interface
title: "Adapter interface: src/adapters/types.ts"
kind: map
tags: [adapters, interface, claude-code, extension-point]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/architecture.md
relates_to: [practice-v1-claude-code-only, map-ai-knowledge-base-cli]
depends_on: []
confidence: medium
summary: "Single seam for assistant-specific code. v1 ships adapters/claude.ts only; add an adapter by implementing the methods and dispatching from init.ts."
---

# Adapter interface: `src/adapters/types.ts`

The single seam for assistant-specific code. Every code path that talks to an assistant routes through an `Adapter`.

```ts
interface Adapter {
  name: string;
  hookInstallPath(): string;
  skillInstallPath(): string;
  writeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void>;
  readTranscript(hookInput: unknown): Promise<RoleTaggedTranscript>;
  runHeadless<T>(promptBody: string, stdin: string, schema: ZodSchema<T>, opts?: HeadlessOpts): Promise<T>;
  renderSkill(spec: SkillSpec): string;
}
```

`readTranscript` returns role-tagged content because the stage-2 extractor's pass 1 (practice) operates only on user turns. `runHeadless` is the only entry point that spawns `claude -p`; it sets `KB_BUILDER_INTERNAL=1` on the child.

v1 ships `src/adapters/claude.ts` as the only implementation. Adding an adapter: implement every method, then dispatch from `src/commands/init.ts`.
