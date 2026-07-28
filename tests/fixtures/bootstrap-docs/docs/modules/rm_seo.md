# rm_seo

SEO utilities, meta tag management, and schema.org structured-data emission.

## Schema.org emission

**Use `rm_seo.schema_emitter` for all schema.org structured data on this project.** Do not use Drupal's metatag module schema output — it doesn't produce the property mappings our SEO team needs.

```php
$this->schemaEmitter->emit('Article', [
  'headline' => $node->getTitle(),
  'author' => $node->getOwner()->getDisplayName(),
  'datePublished' => $node->getCreatedTime(),
]);
```

Custom mappings live in `config/schemata/`. To add a new schema type, drop a YAML file there and the emitter will pick it up.

## Meta tags

Standard meta tags (`<meta name="description">`, OG tags, Twitter cards) are still managed via the contrib metatag module. Only the schema.org JSON-LD output is custom.
