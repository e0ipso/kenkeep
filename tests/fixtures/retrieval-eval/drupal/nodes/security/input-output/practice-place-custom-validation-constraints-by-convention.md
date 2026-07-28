---
type: practice
title: Place custom validation constraints by convention
description: >-
  Custom entity validation constraints and validators belong in
  Plugin/Validation/Constraint with matching names.
tags:
  - drupal
  - entities
  - validation
kk_schema_version: 3
kk_id: practice-place-custom-validation-constraints-by-convention
kk_derived_from:
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21Constraint.php/class/Constraint/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21UniqueField.php/class/UniqueField/11.x
  - >-
    https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Avalidate/11.x
kk_relates_to:
  - map-drupal-entity-form-bases
  - map-typed-entity-wrapper-structure
  - practice-align-content-entity-keys-with-base-fields
kk_depends_on: []
kk_confidence: medium
---
Custom validation constraints and their validators should both live in `Plugin/Validation/Constraint/`. The validator class must follow the `{ConstraintClassName}Validator` naming convention.

Apply constraints to base fields with `addConstraint()`, and call entity `validate()` when programmatic validation is needed. `UniqueField` is case-insensitive by default; set `caseSensitive` to TRUE when exact matching is required.

<!-- kk:related:start -->
# Related

- Related: [map-drupal-entity-form-bases](/drupal/presentation/forms/map-drupal-entity-form-bases.md)
- Related: [map-typed-entity-wrapper-structure](/drupal/content-model/entities-fields/map-typed-entity-wrapper-structure.md)
- Related: [practice-align-content-entity-keys-with-base-fields](/drupal/content-model/layout-paragraphs/practice-align-content-entity-keys-with-base-fields.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21Constraint.php/class/Constraint/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21Constraint.php/class/Constraint/11.x)
[2] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21UniqueField.php/class/UniqueField/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Validation%21Plugin%21Validation%21Constraint%21UniqueField.php/class/UniqueField/11.x)
[3] [https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Avalidate/11.x](https://api.drupal.org/api/drupal/core%21lib%21Drupal%21Core%21Entity%21EntityInterface.php/function/EntityInterface%3A%3Avalidate/11.x)
<!-- kk:citations:end -->
