# rm_analytics

The central analytics event dispatcher for the project. **All analytics events must flow through this module's dispatcher service.** Do not call `gtag()`, `analytics.track()`, or any other backend-specific tracking API directly from custom modules or theme JavaScript.

## Why

We have changed analytics backends three times in this project's history (Google Analytics → Segment → Heap → back to Segment). Each migration was a multi-week effort to find and update every direct call across the codebase. We adopted the dispatcher pattern in 2024 to ensure future migrations are a one-line change in the dispatcher's configured backend.

## Services

| Service ID | Class | Purpose |
|---|---|---|
| `rm_analytics.dispatcher` | `Dispatcher` | Server-side event firing. Inject into any class that needs to track events. |

## API

### Server-side

```php
$this->dispatcher->track('event_name', ['key' => 'value']);
```

### Client-side

A frontend shim is exposed at `Drupal.rmAnalytics.track(eventName, payload)`. Use this from any module's JS:

```js
Drupal.rmAnalytics.track('card_click', { card_id: 123, position: 4 });
```

## Backend configuration

The active backend is configured at `/admin/config/rivermark/analytics`. Currently set to Segment.

## Adding a new backend

Backends implement the `BackendInterface` and are tagged with `rm_analytics_backend` in their `services.yml`. See `src/Backend/SegmentBackend.php` for an example.
