<?php

namespace Drupal\evander_webmcp\Content;

use Drupal\Core\Security\TrustedCallbackInterface;

final class SectionRender implements TrustedCallbackInterface {
  public static function attach(array &$build, string $namespace): void {
    $build['#evander_namespace'] = $namespace;
    $callback = [self::class, 'decorate'];
    if (!in_array($callback, $build['#post_render'] ?? [], TRUE)) $build['#post_render'][] = $callback;
  }
  public static function trustedCallbacks(): array { return ['decorate']; }
  public static function decorate($html, array $build): string { return HtmlChunks::decorate((string) $html, $build['#evander_namespace']); }
}
