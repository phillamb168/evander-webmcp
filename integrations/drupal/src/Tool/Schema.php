<?php

namespace Drupal\evander_webmcp\Tool;

/** Deliberately small, fail-closed JSON Schema subset for preview tool inputs. */
final class Schema {
  private const KEYS = ['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description', 'title', 'minLength', 'maxLength', 'minimum', 'maximum', 'maxItems'];

  public static function checkSchema(array $schema): void {
    if (array_diff(array_keys($schema), self::KEYS) || !in_array($schema['type'] ?? '', ['object', 'array', 'string', 'integer', 'number', 'boolean'], TRUE)) {
      throw new \InvalidArgumentException('Unsupported input schema.');
    }
    if ($schema['type'] === 'object') {
      if (($schema['additionalProperties'] ?? NULL) !== FALSE) throw new \InvalidArgumentException('Objects must reject unknown properties.');
      foreach ((array) ($schema['properties'] ?? []) as $child) self::checkSchema($child);
    }
    if ($schema['type'] === 'array') self::checkSchema($schema['items'] ?? []);
  }

  public static function validate(mixed $value, array $schema, string $path = 'arguments'): void {
    $type = $schema['type'] ?? '';
    $valid = match ($type) {
      'object' => is_array($value) && ($value === [] || !array_is_list($value)),
      'array' => is_array($value) && array_is_list($value),
      'string' => is_string($value),
      'integer' => is_int($value),
      'number' => is_int($value) || is_float($value),
      'boolean' => is_bool($value),
      default => FALSE,
    };
    if (!$valid || (isset($schema['enum']) && !in_array($value, $schema['enum'], TRUE))) throw new \InvalidArgumentException("Invalid $path.");
    if ($type === 'object') {
      $properties = (array) ($schema['properties'] ?? []);
      if (array_diff(array_keys($value), array_keys($properties))) throw new \InvalidArgumentException("Unknown property in $path.");
      foreach ($schema['required'] ?? [] as $key) if (!array_key_exists($key, $value)) throw new \InvalidArgumentException("Missing $path.$key.");
      foreach ($value as $key => $item) self::validate($item, $properties[$key], "$path.$key");
    }
    if ($type === 'string' && (mb_strlen($value) < ($schema['minLength'] ?? 0) || mb_strlen($value) > ($schema['maxLength'] ?? 2048))) throw new \InvalidArgumentException("Invalid length for $path.");
    if (in_array($type, ['integer', 'number'], TRUE) && (!is_finite((float) $value) || $value < ($schema['minimum'] ?? -INF) || $value > ($schema['maximum'] ?? INF))) throw new \InvalidArgumentException("Invalid number for $path.");
    if ($type === 'array') {
      if (count($value) > ($schema['maxItems'] ?? 50)) throw new \InvalidArgumentException("Too many values for $path.");
      foreach ($value as $i => $item) self::validate($item, $schema['items'], "$path.$i");
    }
  }
}
