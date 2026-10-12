<?php

namespace Drupal\evander_webmcp\Plugin\EvanderTool;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\evander_webmcp\Attribute\EvanderTool;
use Drupal\evander_webmcp\Content\PageReader;
use Drupal\evander_webmcp\Tool\ToolBase;
use Symfony\Component\DependencyInjection\ContainerInterface;

#[EvanderTool(id: 'evander_read_page', title: 'Read a public page', description: 'Read exact public page passages with source links and section anchors. Follow next for omitted chunks. A partial response is not evidence that missing content does not exist.')]
class ReadPage extends ToolBase implements ContainerFactoryPluginInterface {
  protected PageReader $reader;
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    $instance = new static($configuration, $plugin_id, $plugin_definition);
    $instance->reader = $container->get('evander_webmcp.page_reader');
    return $instance;
  }
  public function schema(): array {
    return ['type' => 'object', 'properties' => [
      'path' => ['type' => 'string', 'maxLength' => 2048, 'description' => 'Verified same-origin page path, without query or fragment.'],
      'offset' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
      'snapshot' => ['type' => 'string', 'maxLength' => 64],
    ], 'required' => ['path'], 'additionalProperties' => FALSE];
  }
  public function execute(array $arguments): array { return $this->reader->read($arguments['path'], $arguments['offset'] ?? 0, $arguments['snapshot'] ?? NULL); }
}
