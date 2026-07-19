---
type: practice
title: Prevent SQL injection with safe query APIs
description: >-
  Prefer Entity Query and parameterized Database API calls; never concatenate
  user input into SQL.
tags:
  - security
  - sql
  - database
  - drupal
kk_schema_version: 3
kk_id: practice-prevent-sql-injection-with-safe-query-apis
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries'
  - 'https://www.drupal.org/docs/drupal-apis/database-api/static-queries'
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x
kk_relates_to:
  - practice-secure-custom-table-queries
  - map-drupal-security-patterns-by-context
  - practice-avoid-common-security-vulnerabilities
kk_depends_on: []
kk_confidence: high
---
Prefer Drupal Entity Query when possible, and keep `accessCheck(TRUE)` on user-facing entity queries. When using the Database API, build queries with placeholders, `condition()`, `insert()`, and `update()` rather than string concatenation.

Escape LIKE patterns with `$database->escapeLike()` because percent and underscore are wildcards. Use parameterized `query()` for raw SQL when the query builder is not suitable.

Never put user input directly into SQL identifiers or clauses. Dynamic table names, column names, sort fields, and similar identifiers must come from explicit allowlists.

<!-- kk:related:start -->
# Related

- Related: [practice-secure-custom-table-queries](/drupal/security/input-output/practice-secure-custom-table-queries.md)
- Related: [map-drupal-security-patterns-by-context](/drupal/security/input-output/map-drupal-security-patterns-by-context.md)
- Related: [practice-avoid-common-security-vulnerabilities](/drupal/security/input-output/practice-avoid-common-security-vulnerabilities.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries](https://www.drupal.org/docs/drupal-apis/database-api/dynamic-queries)
[2] [https://www.drupal.org/docs/drupal-apis/database-api/static-queries](https://www.drupal.org/docs/drupal-apis/database-api/static-queries)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Database%21Connection.php/function/Connection%3A%3AescapeLike/11.x)
<!-- kk:citations:end -->
