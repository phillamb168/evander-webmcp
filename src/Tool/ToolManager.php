<?php

namespace Drupal\evander_webmcp\Tool;

use Drupal\Core\Cache\CacheBackendInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\Core\Plugin\DefaultPluginManager;
use Drupal\evander_webmcp\Attribute\EvanderTool;

final class ToolManager extends DefaultPluginManager {
  public function __construct(\Traversable $namespaces, CacheBackendInterface $cache_backend, ModuleHandlerInterface $module_handler) {
    parent::__construct('Plugin/EvanderTool', $namespaces, $module_handler, ToolInterface::class, EvanderTool::class);
    $this->alterInfo('evander_webmcp_tool_info');
    $this->setCacheBackend($cache_backend, 'evander_webmcp_tool_plugins');
  }

  public function manifest(array $enabled): array {
    $tools = [];
    foreach (array_intersect(array_keys($this->getDefinitions()), $enabled) as $id) {
      $definition = $this->getDefinition($id);
      $plugin = $this->createInstance($id);
      Schema::checkSchema($plugin->schema());
      $tools[] = [
        'name' => $id, 'title' => (string) $definition['title'],
        'description' => (string) $definition['description'], 'inputSchema' => $plugin->schema(),
        'annotations' => ['readOnlyHint' => TRUE, 'untrustedContentHint' => TRUE],
      ];
    }
    return $tools;
  }
}
