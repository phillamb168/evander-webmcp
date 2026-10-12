<?php

namespace Drupal\evander_webmcp\Content;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Entity\Entity\EntityViewDisplay;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Plugin\Context\Context;
use Drupal\Core\Plugin\Context\ContextDefinition;
use Drupal\Core\Plugin\Context\EntityContext;
use Drupal\Core\Session\AnonymousUserSession;

/** Explicitly approved rendered fields/blocks; never dispatch page controllers. */
final class Components {
  public function builds($node, array &$omissions): array {
    $settings = \Drupal::config('evander_webmcp.settings');
    $display = EntityViewDisplay::collectRenderDisplay($node, 'full');
    $out = [];
    if ($display instanceof \Drupal\layout_builder\Entity\LayoutBuilderEntityViewDisplay && $display->isLayoutBuilderEnabled()) {
      $contexts = [
        'entity' => EntityContext::fromEntity($node), 'layout_builder.entity' => EntityContext::fromEntity($node),
        'display' => EntityContext::fromEntity($display),
        'view_mode' => new Context(ContextDefinition::create('string'), $display->getMode()),
      ] + PublicContext::runtimeContexts(array_keys(\Drupal::service('context.repository')->getAvailableContexts()));
      $storage = \Drupal::service('plugin.manager.layout_builder.section_storage')->findByContext($contexts, new CacheableMetadata());
      if (!$storage) $omissions[] = 'Layout storage unavailable';
      foreach ($storage?->getSections() ?? [] as $section) {
        foreach ($section->getLayout()->getPluginDefinition()->getRegionNames() as $region) {
          foreach ($section->getComponentsByRegion($region) as $component) {
            try {
              $plugin = $component->getPlugin($contexts); $id = $plugin->getPluginId();
              if (str_starts_with($id, 'field_block:')) {
                $field = substr($id, strrpos($id, ':') + 1);
                if (!in_array($field, $settings->get('allowed_fields') ?? [], TRUE)) { $omissions[] = 'Unconfigured layout field'; continue; }
                if (!self::publicField($node, $field)) continue;
              }
              elseif (!in_array($id, $settings->get('allowed_blocks') ?? [], TRUE) || !self::publishedBlock($plugin)) { $omissions[] = 'Unconfigured or unavailable layout block'; continue; }
              if (!$plugin->access(new AnonymousUserSession())) continue;
              $namespace = 'evander-' . $node->id() . '-component-' . $component->getUuid();
              $out[] = ['namespace' => $namespace, 'build' => $component->toRenderArray($contexts)];
            }
            catch (\Throwable) { $omissions[] = 'A layout component could not be read'; }
          }
        }
      }
    }
    else {
      foreach ($display->getComponents() as $field => $options) {
        if (!$node->hasField($field) || $node->get($field)->isEmpty()) continue;
        if (!in_array($field, $settings->get('allowed_fields') ?? [], TRUE)) { $omissions[] = 'Unconfigured displayed content'; continue; }
        if (!self::publicField($node, $field)) continue;
        $out[] = ['namespace' => 'evander-' . $node->id() . '-' . $field, 'build' => $node->get($field)->view($options)];
      }
    }
    // Placed block configuration IDs (or Layout Builder plugin IDs) are explicit.
    $theme = \Drupal::config('system.theme')->get('default');
    $blocks = \Drupal::entityTypeManager()->getStorage('block')->loadByProperties(['theme' => $theme, 'status' => TRUE]);
    $access = new \Drupal\block\BlockAccessControlHandler(\Drupal::entityTypeManager()->getDefinition('block'), \Drupal::service('context.handler'), new PublicContextRepository());
    foreach ($blocks as $block) {
      if (!in_array($block->id(), $settings->get('allowed_blocks') ?? [], TRUE)) continue;
      if (in_array($block->getPluginId(), ['system_main_block', 'system_messages_block', 'local_tasks_block'], TRUE)) continue;
      if (!$access->access($block, 'view', new AnonymousUserSession()) || !self::publishedBlock($block->getPlugin())) continue;
      $out[] = ['namespace' => 'evander-block-' . $block->id(), 'build' => \Drupal::entityTypeManager()->getViewBuilder('block')->view($block)];
    }
    // Extensions may add safe render arrays; they must enforce public access and
    // emit matching anchors in their normal page output. This is trusted code.
    \Drupal::moduleHandler()->alter('evander_webmcp_components', $out, $node, $omissions);
    return $out;
  }

  public static function publicField($entity, string $field, int $depth = 0): bool {
    if ($depth > 8 || !$entity->hasField($field) || !$entity->get($field)->access('view', new AnonymousUserSession())) return FALSE;
    foreach ($entity->get($field) as $item) {
      if ($item->mainPropertyName() !== 'target_id') continue;
      $reference = $item->entity;
      if (!$reference || !$reference->access('view', new AnonymousUserSession()) || ($reference instanceof EntityPublishedInterface && !$reference->isPublished())) return FALSE;
      if ($reference->getEntityTypeId() === 'paragraph') {
        foreach (EntityViewDisplay::collectRenderDisplay($reference, 'default')->getComponents() as $child => $options) {
          if ($reference->hasField($child) && !self::publicField($reference, $child, $depth + 1)) return FALSE;
        }
      }
    }
    return TRUE;
  }

  private static function publishedBlock($plugin): bool {
    $id = $plugin->getPluginId();
    if (str_starts_with($id, 'block_content:')) {
      $entities = \Drupal::entityTypeManager()->getStorage('block_content')->loadByProperties(['uuid' => substr($id, 14)]);
      $entity = reset($entities);
      return $entity && $entity->isPublished() && $entity->access('view', new AnonymousUserSession());
    }
    if (str_starts_with($id, 'inline_block:')) {
      $config = $plugin->getConfiguration();
      if (!empty($config['block_serialized']) || empty($config['block_revision_id'])) return FALSE;
      $entity = \Drupal::entityTypeManager()->getStorage('block_content')->loadRevision($config['block_revision_id']);
      return $entity && $entity->isPublished() && $entity->access('view', new AnonymousUserSession());
    }
    return TRUE;
  }
}
