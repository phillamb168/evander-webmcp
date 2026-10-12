<?php
namespace Drupal\evander_webmcp\EventSubscriber;
use Drupal\evander_webmcp\Content\SectionRender;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
final class SectionComponents implements EventSubscriberInterface {
  public static function getSubscribedEvents(): array { return ['section_component.build.render_array' => ['decorate', -100]]; }
  public function decorate($event): void {
    if ($event->inPreview()) return;
    $id = $event->getPlugin()->getPluginId();
    $config = \Drupal::config('evander_webmcp.settings');
    $allowed = str_starts_with($id, 'field_block:') ? in_array(substr($id, strrpos($id, ':') + 1), $config->get('allowed_fields') ?? [], TRUE) : in_array($id, $config->get('allowed_blocks') ?? [], TRUE);
    if (!$allowed) return;
    $build = $event->getBuild();
    $entity = ($event->getContexts()['layout_builder.entity'] ?? NULL)?->getContextValue();
    if ($build && $entity) { SectionRender::attach($build, 'evander-' . $entity->id() . '-component-' . $event->getComponent()->getUuid()); $event->setBuild($build); }
  }
}
