---
type: practice
title: Tag custom normalizers explicitly
description: >-
  Custom serialization normalizers need an explicit normalizer service tag with
  priority.
tags:
  - http
  - serialization
  - services
kk_schema_version: 3
kk_id: practice-tag-custom-normalizers-explicitly
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21serialization%21serialization.services.yml/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21ContentEntityNormalizer.php/class/ContentEntityNormalizer/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21NormalizerBase.php/class/NormalizerBase/11.x
kk_relates_to:
  - map-advanced-drupal-service-patterns
  - map-drupal-service-definitions-and-common-services
  - map-jsonrpc-method-plugins
kk_depends_on: []
kk_confidence: high
---
When adding a custom serialization normalizer, extend the appropriate base such as `ContentEntityNormalizer`, implement `getSupportedTypes()` for the supported class or interface, and adjust normalized data in `normalize()` by adding computed values or removing internal fields.

Register the normalizer as a service with an explicit `normalizer` tag and `priority`. The documentation calls out that normalizer tags with priority are not autoconfigured, so the tag must stay in the service definition even when service defaults use autowire and autoconfigure.

<!-- kk:related:start -->
# Related

- Related: [map-advanced-drupal-service-patterns](/drupal/architecture/services/map-advanced-drupal-service-patterns.md)
- Related: [map-drupal-service-definitions-and-common-services](/drupal/architecture/services/map-drupal-service-definitions-and-common-services.md)
- Related: [map-jsonrpc-method-plugins](/drupal/apis/map-jsonrpc-method-plugins.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21modules%21serialization%21serialization.services.yml/11.x](https://api.drupal.org/api/drupal/core%21modules%21serialization%21serialization.services.yml/11.x)
[2] [https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21ContentEntityNormalizer.php/class/ContentEntityNormalizer/11.x](https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21ContentEntityNormalizer.php/class/ContentEntityNormalizer/11.x)
[3] [https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21NormalizerBase.php/class/NormalizerBase/11.x](https://api.drupal.org/api/drupal/core%21modules%21serialization%21src%21Normalizer%21NormalizerBase.php/class/NormalizerBase/11.x)
<!-- kk:citations:end -->
