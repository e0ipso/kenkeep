# Dependency Injection

All custom controllers, services, and form classes in this project use **constructor injection**. Direct calls to `\Drupal::service()` from inside these classes are not permitted.

## Pattern

```php
class CardFeedController extends ControllerBase {
  public function __construct(
    private readonly CardSourceResolver $sourceResolver,
    private readonly CardFieldMapper $fieldMapper,
  ) {}

  public static function create(ContainerInterface $container): self {
    return new self(
      $container->get('rm_cards.source_resolver'),
      $container->get('rm_cards.field_mapper'),
    );
  }
}
```

## Rationale

We adopted this pattern after struggling with `\Drupal::service()` calls scattered across the codebase. Two problems:

1. **Testing.** Service-locator-style calls cannot be easily mocked; tests had to spin up the full container or use brittle service mocks. Constructor injection lets tests pass plain doubles.
2. **Refactoring.** Locating all callers of a service via grep is unreliable when the call is buried inside a method. Explicit constructor parameters make the dependency graph readable.

The canonical example is `modules/custom/rm_cards/src/Controller/CardFeedController.php`.

## Exceptions

Hook implementations (`hook_*` functions in `.module` files) are procedural and have no constructor. In those, `\Drupal::service()` is acceptable but should be minimized — delegate to an injected service class as soon as possible.
