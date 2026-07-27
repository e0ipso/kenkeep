---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000014
harness: claude
captured_at: '2026-01-15T11:05:00.000Z'
---
[USER]: I am trying to understand how we might expose Harbor Exchange records to partners.
[AGENT]: I’ll inventory the transports already used in the repository and compare them without editing product files.
[AGENT]: `rg` found JSON:API configuration, custom REST resources, and JSON-RPC methods in separate modules. None is clearly the default for partner exchange.
[USER]: Please map the tradeoffs for entity CRUD, a curated response, and an action-oriented endpoint.
[AGENT]: I’m reading one representative implementation and access test for each so the comparison reflects local seams rather than framework generalities.
[AGENT]: JSON:API exposes entity-shaped data with standard CRUD. A custom REST resource controls the payload explicitly. JSON-RPC fits action semantics but does not naturally expose collection browsing.
[AGENT]: Each option still needs partner access checks and a stable external contract; this evidence does not select one.
[USER]: What about versioning and partner-specific fields?
[AGENT]: JSON:API Extras can alter exposed paths and fields, REST can version a curated schema, and JSON-RPC can version method parameters. A bridge could isolate partner differences behind any of them.
[AGENT]: I see no current code or requirement that resolves the tradeoff. I’ll keep the options separate in the research notes.
[USER]: Useful. Do not select one or edit files yet. I need to discuss the options with the integration team.
[AGENT]: No product files changed. The session ends with three open alternatives and no adopted transport, schema, or partner-field strategy.
