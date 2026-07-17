---
type: practice
title: Use stream wrappers for files
description: >-
  Use Drupal file stream wrappers and explicit collision handling instead of
  absolute filesystem paths.
tags:
  - files
  - storage
  - drupal
kk_schema_version: 3
kk_id: practice-use-stream-wrappers-for-files
kk_derived_from:
  - 'https://www.drupal.org/docs/drupal-apis/file-api'
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileSystemInterface.php/interface/FileSystemInterface/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileExists.php/enum/FileExists/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x
kk_relates_to:
  - practice-handle-files-securely
  - map-advanced-drupal-service-patterns
  - map-ajax-command-reference-surface
kk_depends_on: []
kk_confidence: medium
---
Use stream wrapper URIs such as `public://`, `private://`, and `temporary://` for file operations instead of absolute paths. Use `FileSystemInterface::CREATE_DIRECTORY` with `prepareDirectory()` when a directory should be created.

When writing files in current Drupal 10/11 code, choose explicit collision behavior such as `FileExists::Replace` or `FileExists::Rename`; legacy constants may still appear in older Drupal 10 code. Custom private-file downloads require an access decision through `hook_file_download()` or an equivalent checked controller.

<!-- kk:related:start -->
# Related

- Related: [practice-handle-files-securely](/drupal/security/input-output/practice-handle-files-securely.md)
- Related: [map-advanced-drupal-service-patterns](/drupal/architecture/services/map-advanced-drupal-service-patterns.md)
- Related: [map-ajax-command-reference-surface](/drupal/presentation/frontend-theme/map-ajax-command-reference-surface.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://www.drupal.org/docs/drupal-apis/file-api](https://www.drupal.org/docs/drupal-apis/file-api)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileSystemInterface.php/interface/FileSystemInterface/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileSystemInterface.php/interface/FileSystemInterface/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileExists.php/enum/FileExists/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21File%21FileExists.php/enum/FileExists/11.x)
[4] [https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x](https://api.drupal.org/api/drupal/core%21modules%21system%21system.api.php/function/hook_file_download/11.x)
<!-- kk:citations:end -->
