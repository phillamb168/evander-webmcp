<?php

namespace Drupal\evander_webmcp\Plugin\EvanderTool;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\evander_webmcp\Attribute\EvanderTool;
use Drupal\evander_webmcp\Tool\ToolBase;
use Symfony\Component\DependencyInjection\ContainerInterface;

#[EvanderTool(id: 'evander_find_pages', title: 'Find public site pages', description: 'Discover public pages. Uses configured Search API for full-text search; otherwise matches known sitemap/navigation paths and labels only. Read returned paths to answer factual questions.')]
final class FindPages extends ToolBase implements ContainerFactoryPluginInterface {
  private $discovery;
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    $instance = new static($configuration, $plugin_id, $plugin_definition);
    $instance->discovery = $container->get('evander_webmcp.discovery');
    return $instance;
  }
  public function schema(): array { return ['type' => 'object', 'properties' => ['query' => ['type' => 'string', 'maxLength' => 200], 'offset' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000]], 'additionalProperties' => FALSE]; }
  public function execute(array $arguments): array { return $this->discovery->find($arguments['query'] ?? '', $arguments['offset'] ?? 0); }
}
