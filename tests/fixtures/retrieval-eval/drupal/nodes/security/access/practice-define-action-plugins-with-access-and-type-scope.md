---
type: practice
title: Define action plugins with access and type scope
description: >-
  Action plugins live under Plugin\Action and should declare scope, access
  behavior, and configuration as needed.
tags:
  - drupal
  - plugins
  - actions
kk_schema_version: 3
kk_id: practice-define-action-plugins-with-access-and-type-scope
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21Attribute%21Action.php/class/Action/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ActionInterface.php/function/ActionInterface%3A%3Aaccess/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ConfigurableActionBase.php/class/ConfigurableActionBase/11.x
kk_relates_to:
  - map-derivative-plugins-generate-dynamic-plugin-instances
  - map-drupal-mail-flow
  - practice-alter-and-debug-plugin-definitions-through-managers
kk_depends_on: []
kk_confidence: high
---
Define new action plugins in the `Plugin\Action` namespace with the current `#[Action(...)]` attribute. Set `type` when the action should apply only to specific entity types; omit it when the action should apply broadly.

Simple actions can extend `ActionBase` and implement `execute()`. Configurable actions should extend `ConfigurableActionBase` and implement `defaultConfiguration()`, `buildConfigurationForm()`, and `submitConfigurationForm()`.

Implement `access()` carefully: return an `AccessResultInterface` when `$return_as_object` is TRUE and a boolean otherwise, matching the action plugin interface.

<!-- kk:related:start -->
# Related

- Related: [map-derivative-plugins-generate-dynamic-plugin-instances](/drupal/architecture/plugins/map-derivative-plugins-generate-dynamic-plugin-instances.md)
- Related: [map-drupal-mail-flow](/drupal/architecture/services/map-drupal-mail-flow.md)
- Related: [practice-alter-and-debug-plugin-definitions-through-managers](/drupal/quality/practice-alter-and-debug-plugin-definitions-through-managers.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21Attribute%21Action.php/class/Action/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21Attribute%21Action.php/class/Action/11.x)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ActionInterface.php/function/ActionInterface%3A%3Aaccess/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ActionInterface.php/function/ActionInterface%3A%3Aaccess/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ConfigurableActionBase.php/class/ConfigurableActionBase/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Action%21ConfigurableActionBase.php/class/ConfigurableActionBase/11.x)
<!-- kk:citations:end -->
