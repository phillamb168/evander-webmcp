<?php

namespace Drupal\evander_webmcp\Tool;

use Drupal\Core\Plugin\PluginBase;

abstract class ToolBase extends PluginBase implements ToolInterface {
  public function schema(): array {
    return ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => FALSE];
  }
}
