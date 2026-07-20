---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000011
harness: claude
captured_at: '2026-01-15T10:50:00.000Z'
---
[USER]: Before changing the partner feed, locate the Harbor Exchange system for me.
[AGENT]: I’ll follow the REST route through its injected services and queue worker instead of guessing from module names.
[AGENT]: `rg` found entry points in the API module, a partner selector service, and import entities owned elsewhere. The request arrives in the API module, but that does not look like the system boundary.
[USER]: The major system lives in `modules/custom/harbor_exchange`. Partner-specific adapters are under `src/Bridge`, while canonical import records stay in the module's content entity storage.
[AGENT]: That matches the service graph. The REST resource delegates to a bridge selected by partner plugin ID, and the bridge persists canonical records through Harbor Exchange storage.
[AGENT]: I initially opened `harbor_api/src/Partner` for the new adapter. I’m discarding that path and reading the existing bridge contract under the owning module.
[USER]: Exactly. `harbor_exchange` is the ownership boundary. Do not scatter new partner adapters into the API module even though that is where requests arrive.
[AGENT]: I’ll add the adapter under `modules/custom/harbor_exchange/src/Bridge` and register it with the existing selector.
[AGENT]: The focused contract test failed because the fixture used the external partner code instead of the plugin ID. I’m matching the neighboring adapter fixture.
[USER]: Run the bridge contract tests after adding it.
[AGENT]: All bridge contract cases pass, including selection and canonical-record persistence.
[AGENT]: The final diff keeps the adapter and its tests inside Harbor Exchange; the API module only retains request delegation.
