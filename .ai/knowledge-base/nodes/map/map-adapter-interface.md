---
schema_version: 1
id: map-adapter-interface
title: "Assistant adapter interface"
kind: map
tags: [adapter, extensibility, interface]
derived_from:
  - docs/internals/architecture.md
relates_to: []
confidence: high
summary: "src/adapters/types.ts defines the assistant-agnostic adapter contract; claude.ts is the v1 implementation."
---

# Assistant adapter interface

`src/adapters/types.ts` defines the contract that isolates assistant-specific code:

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

Adding a new assistant: implement the methods in `src/adapters/<name>.ts`, then dispatch from `src/commands/init.ts`. The `--assistants <list>` flag on `init` accepts multiple adapters and exists for forward compatibility.

In v1 only `claude` (Claude Code) is supported. Adapters for other assistants are deferred to v2.
