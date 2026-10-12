<?php
/** Real Drupal services, admin caller, anonymous output. Disposable fixtures only. */
if (!str_starts_with((string) \Drupal::config('system.site')->get('name'), 'Evander Drupal')) throw new RuntimeException('Fixture site required.');
$settings = \Drupal::configFactory()->getEditable('evander_webmcp.settings');
$saved = $settings->getRawData(); $checks = 0;
$assert = function ($condition, $label) use (&$checks) { if (!$condition) throw new RuntimeException($label); $checks++; };
$context = \Drupal::service('evander_webmcp.public_context');
$reader = \Drupal::service('evander_webmcp.page_reader');
$discovery = \Drupal::service('evander_webmcp.discovery');
$switcher = \Drupal::service('account_switcher'); $switcher->switchTo(\Drupal\user\Entity\User::load(1));
$index = \Drupal\search_api\Entity\Index::load('preview');
try {
  // Disabling an index removes its indexed data. Make this repeatable and
  // restore the disposable fixture after that deliberately disruptive check.
  $index->indexItems();
  try { $reader->read('/node/3'); throw new RuntimeException('Admin leaked unpublished node'); } catch (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException) { $checks++; }
  $assert((int) \Drupal::currentUser()->id() === 1, 'Caller restored after denied read');
  $settings->set('search_index', 'preview')->set('search_fields', ['title', 'body'])->save();
  $results = $context->anonymous(fn() => $discovery->find('library'));
  $assert(($results['mode'] ?? '') === 'search_api' && count($results['results'] ?? []) === 1, 'Search API matches body text');
  $private = $context->anonymous(fn() => $discovery->find('confidential'));
  $assert(empty($private['results']), 'Search does not reveal unpublished title');
  $settings->set('search_fields', ['status'])->save();
  $assert($context->anonymous(fn() => $discovery->find('anything'))['status'] === 'unavailable', 'Reject non-fulltext configured field');
  $settings->set('search_fields', ['title', 'body'])->save();
  $index->disable()->save();
  $assert($context->anonymous(fn() => $discovery->find('library'))['status'] === 'unavailable', 'Disabled index is explicit, no fake search fallback');
  $index->enable()->save();
  $settings->set('allowed_bundles', ['page'])->save();
  $assert($reader->read('/node/6')['status'] === 'unavailable', 'Bundle allowlist enforced');
  $settings->set('allowed_bundles', [])->set('allowed_fields', [])->save();
  $assert(empty($reader->read('/node/1')['chunks']), 'No raw field fallback when fields are unapproved');
  $settings->set('allowed_fields', ['body'])->set('max_response_bytes', 8000)->save();
  $small = $reader->read('/node/2');
  $assert(strlen(json_encode($small)) <= 8000 && ($small['next']['offset'] ?? 0) > 0, 'Small response budget still advances');
  $fresh = $reader->read('/node/1', 0, '');
  $assert($fresh['status'] === 'ok' && count($fresh['chunks']) > 0, 'Empty optional snapshot does not poison fresh read');
  $settings->set('search_index', '')->set('sitemaps', ['/preview-sitemap.xml'])->save();
  $found = $context->anonymous(fn() => $discovery->find('node/1'));
  $assert(($found['mode'] ?? '') === 'sitemap_navigation' && count($found['results']) === 1, 'Configured sitemap discovery');
  $settings->set('sitemaps', ['/preview-unsafe-sitemap.xml'])->save();
  $unsafe = $context->anonymous(fn() => $discovery->find('not-in-nav'));
  $assert(!empty($unsafe['warnings']) && empty($unsafe['results']), 'Sitemap external entities rejected');
  echo "$checks access/search/budget/sitemap assertions passed.\n";
}
finally {
  try { $index->enable()->save(); $index->indexItems(); $settings->setData($saved)->save(); }
  finally { $switcher->switchBack(); }
}
