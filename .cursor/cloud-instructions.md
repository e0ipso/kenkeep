# Cursor Cloud specific instructions

Durable, non-obvious setup/run caveats for developing this repo inside a Cursor Cloud Agent VM. Standard commands live in [`AGENTS.md`](../AGENTS.md) `## Commands`.

Dependencies are installed automatically on VM startup (`npm install`). Node 22+ is present. The repo is a pure CLI npm package — no daemons or services to run (see the Constitution).

- **Build before running the CLI.** `npm install` only runs `husky`; it does **not** build. Run `npm run build` to produce `dist/` (and the `templates/` tree) before `node dist/cli.js <subcommand>`. `npm test` self-builds via its `pretest` hook, so lint/typecheck/test work without a manual build, but running the CLI does not.
- **Standard commands** are in `## Commands` in `AGENTS.md` (`npm run build`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`). All pass green in this environment (436 tests).
- **`init` uses `--harnesses` (plural):** `node dist/cli.js init --harnesses claude`. The global active-harness selector is the singular `--harness <id>` (e.g. `node dist/cli.js --harness claude doctor`); pass it explicitly since env-based detection only fires inside a real host harness session.
- **`doctor` reports one expected "error" here:** `claude CLI on PATH: not runnable (spawn claude ENOENT)` — no harness binary is installed in the cloud VM. This is an environment limitation, not a repo defect; every other check passes.
