---
type: practice
title: Secure custom table queries
description: >-
  Use placeholders, escape LIKE patterns, and whitelist dynamic table names in
  custom SQL work.
tags:
  - drupal
  - database
  - security
kk_schema_version: 3
kk_id: practice-secure-custom-table-queries
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries'
  - 'https://www.drupal.org/docs/drupal-apis/database-api/static-queries'
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x
kk_relates_to:
  - practice-prevent-sql-injection-with-safe-query-apis
  - map-drupal-security-patterns-by-context
  - practice-avoid-common-security-vulnerabilities
kk_depends_on: []
kk_confidence: high
---
Custom table queries must not concatenate user input into SQL. Use query builder conditions or named placeholders for values.

Escape LIKE search patterns with the database connection's `escapeLike()` method before adding wildcards, and never pass untrusted table names directly into `select()`. If a table name is dynamic, validate it against an explicit whitelist before building the query.

<!-- kk:related:start -->
# Related

- Related: [practice-prevent-sql-injection-with-safe-query-apis](/drupal/security/data-secrets/practice-prevent-sql-injection-with-safe-query-apis.md)
- Related: [map-drupal-security-patterns-by-context](/drupal/security/input-output/map-drupal-security-patterns-by-context.md)
- Related: [practice-avoid-common-security-vulnerabilities](/drupal/security/input-output/practice-avoid-common-security-vulnerabilities.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries](https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries)
[2] [https://www.drupal.org/docs/drupal-apis/database-api/static-queries](https://www.drupal.org/docs/drupal-apis/database-api/static-queries)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x)
<!-- kk:citations:end -->
