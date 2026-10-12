<?php

namespace Drupal\evander_webmcp\Content;

use Drupal\Core\Menu\MenuTreeParameters;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\node\NodeInterface;

/** Search API when configured; otherwise bounded sitemap/navigation discovery. */
final class Discovery {
  public function __construct(private $configFactory, private $menuTree, private $http, private $cache, private $stack, private PublicContext $context, private $modules, private $entities) {}

  public function find(string $query = '', int $offset = 0): array {
    $config = $this->configFactory->get('evander_webmcp.settings');
    if ($config->get('search_index')) {
      if (!$this->modules->moduleExists('evander_webmcp_search_api')) return ['status' => 'unavailable', 'mode' => 'search_api', 'reason' => 'Enable the Search API integration submodule.'];
      return $this->search($query, $offset);
    }
    $candidates = [];
    foreach ($config->get('menus') ?? ['main'] as $menu) {
      $tree = $this->menuTree->load($menu, (new MenuTreeParameters())->onlyEnabledLinks()->setMaxDepth(5));
      $tree = $this->menuTree->transform($tree, [['callable' => 'menu.default_tree_manipulators:checkAccess'], ['callable' => 'menu.default_tree_manipulators:generateIndexAndSort']]);
      $walk = function ($items) use (&$walk, &$candidates) {
        foreach ($items as $item) {
          if (!$item->access || !$item->access->isAllowed()) continue;
          $url = $item->link->getUrlObject();
          if (!$url->isExternal()) $candidates[] = ['label' => $item->link->getTitle(), 'url' => $url->setAbsolute()->toString()];
          $walk($item->subtree);
        }
      };
      $walk($tree);
    }
    $sitemap = $this->sitemaps($config->get('sitemaps') ?? []);
    array_push($candidates, ...$sitemap['links']);
    $seen = []; $matching = [];
    foreach ($candidates as $candidate) {
      if (isset($seen[$candidate['url']])) continue;
      $seen[$candidate['url']] = TRUE;
      if ($query !== '' && mb_stripos($candidate['label'] . ' ' . urldecode($candidate['url']), $query) === FALSE) continue;
      $matching[] = $candidate;
    }
    $results = []; $scanned = 0;
    foreach (array_slice($matching, $offset, 40) as $candidate) {
      ++$scanned;
      $verified = $this->verifyLink($candidate['url']);
      if ($verified) $results[] = $verified;
      if (count($results) >= 10) break;
    }
    return ['status' => 'ok', 'mode' => $config->get('sitemaps') ? 'sitemap_navigation' : 'navigation',
      'notice' => 'Page discovery matches known link labels and paths; full-text search requires Search API.',
      'coverage' => 'partial', 'warnings' => $sitemap['warnings'], 'results' => $results,
      'nextOffset' => $offset + $scanned < count($matching) ? $offset + $scanned : NULL];
  }

  private function search(string $query, int $offset): array {
    try {
      $config = $this->configFactory->get('evander_webmcp.settings');
      $index = $this->entities->getStorage('search_api_index')->load($config->get('search_index'));
      $fields = $config->get('search_fields') ?? [];
      if (!$index || !$index->status() || !$fields || array_diff($fields, array_keys($index->getFields()))) return ['status' => 'unavailable', 'mode' => 'search_api', 'reason' => 'Configure an enabled index and approved full-text fields.'];
      foreach ($fields as $id) {
        $type = $index->getField($id)->getType();
        if ($type !== 'text' && !str_starts_with($type, 'solr_text')) return ['status' => 'unavailable', 'mode' => 'search_api', 'reason' => 'An approved field is no longer a full-text field.'];
      }
      $search = $index->query(['limit' => 20, 'offset' => $offset]);
      $search->setOption('search_api_access_account', new AnonymousUserSession());
      $search->setFulltextFields($fields);
      if ($query !== '') $search->keys($query);
      $response = $search->execute();
      $results = []; $seen = [];
      foreach ($response->getResultItems() as $item) {
        try {
          $object = $item->getOriginalObject()->getValue();
          if (!$object instanceof NodeInterface) continue;
          // Reload so stale indexed publication/labels cannot authorize a result.
          $node = $this->entities->getStorage('node')->load($object->id());
          if (!$node || !$node->isPublished() || !$node->access('view', new AnonymousUserSession())) continue;
          $verified = $this->verifyLink($node->toUrl()->setAbsolute()->toString());
          if ($verified && !isset($seen[$verified['url']])) { $seen[$verified['url']] = TRUE; $results[] = $verified; }
        }
        catch (\Throwable) { continue; }
      }
      // No unfiltered total: a search index may contain inaccessible records.
      return ['status' => 'ok', 'mode' => 'search_api', 'coverage' => 'partial', 'results' => $results,
        'nextOffset' => count($response->getResultItems()) === 20 ? $offset + 20 : NULL,
        'notice' => 'Read a result for authoritative public source passages.'];
    }
    catch (\Throwable) { return ['status' => 'unavailable', 'mode' => 'search_api', 'reason' => 'The configured search service is unavailable; no unverified fallback search was run.']; }
  }

  private function verifyLink(string $url): ?array {
    $origin = $this->stack->getCurrentRequest()->getSchemeAndHttpHost();
    if (!str_starts_with($url, $origin . '/')) return NULL;
    $path = parse_url($url, PHP_URL_PATH);
    if (!is_string($path) || !PublicContext::validPath($path)) return NULL;
    try {
      return $this->context->run($path, function ($request) use ($url) {
        $node = $request->attributes->get('node');
        $bundles = $this->configFactory->get('evander_webmcp.settings')->get('allowed_bundles') ?? [];
        if (!$node instanceof NodeInterface || !$node->isPublished() || !$node->access('view', new AnonymousUserSession()) || ($bundles && !in_array($node->bundle(), $bundles, TRUE))) return NULL;
        return ['label' => $node->label(), 'url' => $url, 'path' => $request->getPathInfo()];
      });
    }
    catch (\Throwable) { return NULL; }
  }

  private function sitemaps(array $urls): array {
    if (!$urls) return ['links' => [], 'warnings' => []];
    $origin = $this->stack->getCurrentRequest()->getSchemeAndHttpHost();
    $id = 'evander:sitemap:' . hash('sha256', $origin . json_encode($urls));
    if ($cached = $this->cache->get($id)) return $cached->data;
    $links = []; $seen = []; $warnings = []; $bytes = 0;
    while ($urls && count($seen) < 10 && count($links) < 10000) {
      $url = array_shift($urls);
      if (str_starts_with($url, '/') && !str_starts_with($url, '//')) $url = $origin . $url;
      if (isset($seen[$url])) continue;
      $seen[$url] = TRUE;
      if (!str_starts_with($url, $origin . '/') || preg_match('/[\x00-\x20\\\\]/', $url)) { $warnings[] = 'Rejected a non-local sitemap'; continue; }
      try {
        $response = $this->http->request('GET', $url, ['timeout' => 3, 'connect_timeout' => 2, 'allow_redirects' => FALSE, 'stream' => TRUE, 'headers' => ['Accept' => 'application/xml']]);
        if ($response->getStatusCode() !== 200) throw new \RuntimeException();
        $body = $response->getBody()->read(2000001);
        $bytes += strlen($body);
        if (strlen($body) > 2000000 || $bytes > 4000000 || preg_match('/<!DOCTYPE|<!ENTITY/i', $body)) throw new \RuntimeException();
        $previous = libxml_use_internal_errors(TRUE);
        try { $xml = simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NONET); }
        finally { libxml_clear_errors(); libxml_use_internal_errors($previous); }
        if (!$xml) throw new \RuntimeException();
        if ($xml->getName() === 'sitemapindex') {
          foreach ($xml->xpath('//*[local-name()="sitemap"]/*[local-name()="loc"]') as $loc) $urls[] = (string) $loc;
        }
        elseif ($xml->getName() === 'urlset') {
          foreach ($xml->xpath('//*[local-name()="url"]/*[local-name()="loc"]') as $loc) {
            $link = (string) $loc;
            if (str_starts_with($link, $origin . '/')) $links[] = ['url' => $link, 'label' => urldecode(parse_url($link, PHP_URL_PATH) ?? '')];
            if (count($links) >= 10000) break;
          }
        }
      }
      catch (\Throwable) { $warnings[] = 'A configured sitemap could not be read safely'; }
    }
    if ($urls || count($links) >= 10000) $warnings[] = 'Sitemap discovery limit reached';
    $result = ['links' => $links, 'warnings' => array_values(array_unique($warnings))];
    $this->cache->set($id, $result, time() + 300, ['config:evander_webmcp.settings']);
    return $result;
  }
}
