---
type: practice
title: Handle uploads and private files securely
description: >-
  Validate uploads server-side, store sensitive files privately, and gate
  private downloads.
tags:
  - security
  - files
  - uploads
  - drupal
kk_schema_version: 3
kk_id: practice-handle-files-securely
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/file-api'
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21system%21src%21FileDownloadController.php/class/FileDownloadController/11.x
kk_relates_to:
  - map-drupal-security-patterns-by-context
  - practice-avoid-common-security-vulnerabilities
  - practice-keep-secrets-out-of-code-and-config
kk_depends_on: []
kk_confidence: high
---
Uploads should use an extension allowlist, server-side MIME validation, size limits, and sanitized filenames. Never allow executable upload types such as PHP, PHTML, PHAR, EXE, or shell scripts. Treat HTML, JavaScript, and SVG uploads as active content: allow only for trusted roles with sanitization and safe download/display handling.

Use `private://` for sensitive files and verify the stream wrapper scheme when private storage is required. Private downloads should route through Drupal; core's file download controller checks `hook_file_download()` access responses, returns not found for missing files, and denies access when no module grants the download. Custom controllers must check access before returning a `BinaryFileResponse`.

Track file usage with Drupal's file usage service, and use signed, time-limited URLs for private downloads when direct links are needed.

<!-- kk:related:start -->
# Related

- Related: [map-drupal-security-patterns-by-context](/drupal/security/input-output/map-drupal-security-patterns-by-context.md)
- Related: [practice-avoid-common-security-vulnerabilities](/drupal/security/input-output/practice-avoid-common-security-vulnerabilities.md)
- Related: [practice-keep-secrets-out-of-code-and-config](/drupal/security/data-secrets/practice-keep-secrets-out-of-code-and-config.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/file-api](https://www.drupal.org/docs/drupal-apis/file-api)
[2] [https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x](https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x)
[3] [https://api.drupal.org/api/drupal/core%21modules%21system%21src%21FileDownloadController.php/class/FileDownloadController/11.x](https://api.drupal.org/api/drupal/core%21modules%21system%21src%21FileDownloadController.php/class/FileDownloadController/11.x)
<!-- kk:citations:end -->
