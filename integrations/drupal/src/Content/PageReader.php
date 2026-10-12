<?php

namespace Drupal\evander_webmcp\Content;

use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Entity\Entity\EntityViewDisplay;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\node\NodeInterface;

final class PageReader {
  public function __construct(private PublicContext $context, private $configFactory, private $entities, private $renderer, private $stack) {}

  public function read(string $path, int $offset = 0, ?string $snapshot = NULL): array {
    return $this->context->run($path, function ($request) use ($path, $offset, $snapshot) {
      $settings = $this->configFactory->get('evander_webmcp.settings');
      $node = $request->attributes->get('node');
      $bundles = $settings->get('allowed_bundles') ?? [];
      if (!$node instanceof NodeInterface || !$node->isPublished() || !$node->access('view', new AnonymousUserSession()) || ($bundles && !in_array($node->bundle(), $bundles, TRUE))) {
        return ['status' => 'unavailable', 'coverage' => 'unavailable', 'reason' => 'No supported public node content for this path.', 'chunks' => [], 'links' => []];
      }
      $budget = max(8000, min(120000, (int) $settings->get('max_response_bytes')));
      $chunkBytes = min(max(256, (int) ($settings->get('chunk_bytes') ?: 6000)), (int) ($budget / 4));
      $chunks = []; $links = []; $omissions = []; $renderedBytes = 0; $anchorOwners = [];
      foreach ((new Components())->builds($node, $omissions) as $component) {
        try {
          $build = $component['build'];
          $namespace = $component['namespace'];
          // Lazy block builders reject arbitrary properties. The normal block
          // view hook decorates their resolved render array on both surfaces.
          if (!isset($build['#lazy_builder'])) SectionRender::attach($build, $namespace);
          $build['#cache']['max-age'] = 0;
          $html = (string) $this->renderer->renderInIsolation($build);
          $renderedBytes += strlen($html);
          if ($renderedBytes > 4 * 1024 * 1024) { $omissions[] = 'Render work limit reached'; break; }
          $extracted = HtmlChunks::extract($html, $namespace, $chunkBytes);
          foreach ($extracted['chunks'] as $chunk) if (isset($chunk['anchor'])) $anchorOwners[$chunk['anchor']][$namespace] = TRUE;
          array_push($chunks, ...$extracted['chunks']);
          array_push($links, ...$extracted['links']);
        }
        catch (\Throwable) { $omissions[] = 'A content formatter could not be read'; }
      }
      foreach ($chunks as &$chunk) {
        if (isset($chunk['anchor']) && count($anchorOwners[$chunk['anchor']] ?? []) > 1) { unset($chunk['anchor']); $omissions[] = 'An ambiguous section anchor was omitted'; }
      }
      unset($chunk);
      $origin = $request->getSchemeAndHttpHost();
      $url = $node->toUrl()->setAbsolute()->toString();
      $links = array_values(array_filter(array_map(fn($link) => $this->link($link, $origin, $url), $links)));
      if (count($links) > 20) $omissions[] = 'Additional links omitted';
      $links = array_slice($links, 0, 20);
      while (strlen(json_encode($links)) > (int) ($budget / 4)) { array_pop($links); $omissions[] = 'Additional links omitted'; }
      $hash = hash('sha256', json_encode([$node->uuid(), $node->getRevisionId(), $chunks, $links, $omissions], JSON_UNESCAPED_UNICODE));
      // A fresh read never needs a snapshot. Models sometimes fill optional
      // strings with ""; only continuation reads compare the snapshot token.
      if ($offset && !$snapshot) throw new \InvalidArgumentException('A snapshot is required for continuation.');
      if ($offset && !hash_equals($hash, $snapshot)) return ['status' => 'stale', 'reason' => 'Content changed. Start reading this page again with offset zero.'];
      $result = [
        'status' => 'ok', 'page' => ['title' => $node->label(), 'url' => $url, 'path' => $path],
        'snapshot' => $hash, 'coverage' => 'partial',
        'omissions' => array_values(array_unique($omissions)), 'chunks' => [], 'links' => $links, 'next' => NULL,
      ];
      foreach (array_slice($chunks, $offset) as $chunk) {
        $result['chunks'][] = $chunk;
        // Account for JSON escaping, continuation and envelope overhead, not
        // just raw text bytes. The first admissible chunk always advances.
        if (strlen(json_encode($result)) > $budget - 3000) { array_pop($result['chunks']); break; }
      }
      $next = $offset + count($result['chunks']);
      if ($next < count($chunks) && !$result['chunks']) return ['status' => 'unavailable', 'reason' => 'A source chunk exceeds the configured response budget.'];
      $result['coverage'] = $omissions || $next < count($chunks) ? 'partial' : 'complete';
      $result['next'] = $next < count($chunks) ? ['path' => $path, 'offset' => $next, 'snapshot' => $hash] : NULL;
      return $result;
    });
  }

  private function link(array $link, string $origin, string $page): ?array {
    $href = $link['url'];
    if (!$link['label'] || preg_match('/[\x00-\x20\\\\]/', $href) || str_starts_with($href, '//')) return NULL;
    if (str_starts_with($href, '#')) $href = $page . $href;
    elseif (str_starts_with($href, '/')) $href = $origin . $href;
    if (!preg_match('@^https?://@', $href)) return NULL;
    return ['label' => mb_substr($link['label'], 0, 180), 'url' => $href];
  }
}
