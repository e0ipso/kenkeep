---
type: practice
title: Secure every API endpoint before processing
description: >-
  Authenticate, authorize, validate, rate limit, and avoid exposing internals in
  API responses.
tags:
  - security
  - api
  - validation
  - auth
kk_schema_version: 3
kk_id: practice-secure-api-endpoints
kk_derived_from:
  - 'https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal'
  - >-
    https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes
  - 'https://www.drupal.org/docs/develop/security/cross-site-request-forgery'
kk_relates_to:
  - practice-validate-input-server-side
  - map-drupal-security-patterns-by-context
  - map-search-api-concepts-and-extension-points
kk_depends_on: []
kk_confidence: high
---
API endpoints should authenticate callers and authorize the requested resource before processing. Token comparisons should use hash_equals(), and endpoints should return consistent errors where revealing existence would allow enumeration.

Validate JSON request bodies, required fields, types, and formats before use. Apply rate limits per IP, user, or endpoint as appropriate.

Responses should expose only public fields, avoid internal status or debug data, set security headers, use no-store caching for sensitive data, configure CORS with an explicit origin allowlist, and log access or failures without sensitive values.

<!-- kk:related:start -->
# Related

- Related: [practice-validate-input-server-side](/drupal/security/input-output/practice-validate-input-server-side.md)
- Related: [map-drupal-security-patterns-by-context](/drupal/security/input-output/map-drupal-security-patterns-by-context.md)
- Related: [map-search-api-concepts-and-extension-points](/drupal/content-model/media-seo-search/map-search-api-concepts-and-extension-points.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal](https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal)
[2] [https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes](https://www.drupal.org/docs/drupal-apis/routing-system/access-checking-on-routes)
[3] [https://www.drupal.org/docs/develop/security/cross-site-request-forgery](https://www.drupal.org/docs/develop/security/cross-site-request-forgery)
<!-- kk:citations:end -->
