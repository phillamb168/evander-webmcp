<?php

namespace Drupal\evander_webmcp\Tool;

/** Public, read-only capabilities. Implement ContainerFactoryPluginInterface for DI. */
interface ToolInterface {
  public function schema(): array;
  public function execute(array $arguments): array;
}
