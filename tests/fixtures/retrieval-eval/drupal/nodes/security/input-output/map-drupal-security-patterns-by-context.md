---
type: map
title: Drupal security patterns by context
description: >-
  Security guidance is organized around common sequences and the
  context-specific docs to consult.
tags:
  - security
  - patterns
  - drupal
kk_schema_version: 3
kk_id: map-drupal-security-patterns-by-context
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/security-api'
  - 'https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal'
  - 'https://www.drupal.org/security'
kk_relates_to:
  - practice-avoid-common-security-vulnerabilities
  - practice-handle-files-securely
  - practice-keep-secrets-out-of-code-and-config
kk_depends_on: []
kk_confidence: high
---
The security patterns guide defines common Drupal security sequences: validate then process safely then log without sensitive data then output safely; permission check then entity access check then operation; and authenticate then validate then rate limit then process for APIs.

It also maps work contexts to the focused security docs to load. Form submissions use input validation first, then SQL injection, file security, and access control as needed. API endpoints start with API security, then input validation, access control, and secrets when API keys are involved.

Content display should consult XSS prevention, access control, and SQL injection where queries are involved. File operations should consult file security, access control, and common vulnerabilities for path traversal.

<!-- kk:related:start -->
# Related

- Related: [practice-avoid-common-security-vulnerabilities](/drupal/security/input-output/practice-avoid-common-security-vulnerabilities.md)
- Related: [practice-handle-files-securely](/drupal/security/input-output/practice-handle-files-securely.md)
- Related: [practice-keep-secrets-out-of-code-and-config](/drupal/security/data-secrets/practice-keep-secrets-out-of-code-and-config.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/security-api](https://www.drupal.org/docs/drupal-apis/security-api)
[2] [https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal](https://www.drupal.org/docs/administering-a-drupal-site/security-in-drupal)
[3] [https://www.drupal.org/security](https://www.drupal.org/security)
<!-- kk:citations:end -->
