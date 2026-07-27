---
schema_version: 1
session_id: 10000000-0000-4000-8000-000000000006
harness: claude
captured_at: '2026-01-15T10:25:00.000Z'
---
[USER]: Diagnose why some Atlas batch status calls lose their tenant context at the edge proxy.
[AGENT]: I’ll compare a failing request with the direct JSON-RPC test and trace where tenant data is read.
[AGENT]: The method accepts `tenant_id` in params, and the direct test passes. I do not see a failure in the handler itself.
[USER]: The direct test is misleading. Send the request through the HTTP test path.
[AGENT]: I’m switching to the functional HTTP fixture and enabling the proxy request log for one run.
[AGENT]: Reproduced. The inbound payload has `tenant_id`, but the forwarded params do not. The proxy log shows its parameter scrubber removed it before dispatch.
[USER]: That integration is finicky. For Atlas batch calls, tenant identity belongs in request metadata, in the `meta` object under `atlas_tenant`, not in method params. Our edge proxy strips tenant-like params before forwarding but preserves approved metadata.
[AGENT]: I’ll move tenant identity to request metadata and have the batch method read `meta.atlas_tenant`.
[AGENT]: My first HTTP assertion used the internal request object and still bypassed the proxy. I’m asserting at the forwarded transport boundary instead.
[USER]: Keep a regression test through the HTTP path. A direct method test cannot catch the proxy rewrite.
[AGENT]: The regression now sends a real HTTP request through the edge proxy and verifies the handler receives `atlas_tenant` in request metadata.
[AGENT]: The focused functional suite passes. The old direct test remains as a handler unit test, but it is no longer the integration proof.
