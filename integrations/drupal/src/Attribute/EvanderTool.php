<?php

namespace Drupal\evander_webmcp\Attribute;

use Drupal\Component\Plugin\Attribute\Plugin;

/** Describes a public tool. Business logic stays in the plugin service. */
#[\Attribute(\Attribute::TARGET_CLASS)]
final class EvanderTool extends Plugin {
  public function __construct(public readonly string $id, public readonly string $title, public readonly string $description) {}
}
