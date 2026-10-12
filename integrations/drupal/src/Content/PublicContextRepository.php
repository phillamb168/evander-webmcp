<?php
namespace Drupal\evander_webmcp\Content;
use Drupal\Core\Plugin\Context\ContextRepositoryInterface;
final class PublicContextRepository implements ContextRepositoryInterface {
  public function getRuntimeContexts(array $context_ids) { return PublicContext::runtimeContexts($context_ids); }
  public function getAvailableContexts() { return \Drupal::service('context.repository')->getAvailableContexts(); }
}
