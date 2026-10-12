<?php
/** Run with drush php:script only in the disposable clean DDEV fixtures. */
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\Core\Entity\Entity\EntityViewDisplay;
use Drupal\menu_link_content\Entity\MenuLinkContent;

if (!str_starts_with((string) \Drupal::config('system.site')->get('name'), 'Evander Drupal')) throw new RuntimeException('Fixture site required.');
$ids = \Drupal::state()->get('evander_preview.seeded', []);
$type = NodeType::load('page') ?? NodeType::create(['type' => 'page', 'name' => 'Basic page']);
$type->save();
if (!FieldStorageConfig::loadByName('node', 'body')) FieldStorageConfig::create(['field_name' => 'body', 'entity_type' => 'node', 'type' => 'text_with_summary'])->save();
node_add_body_field($type);
if (!\Drupal\filter\Entity\FilterFormat::load('full_html')) \Drupal\filter\Entity\FilterFormat::create(['format' => 'full_html', 'name' => 'Fixture HTML', 'filters' => []])->save();
foreach ([
  ['home', 'Welcome to the developer preview', '<h2>Welcome</h2><p>Our fictional community helps people find public information.</p><h2>History</h2><p>We opened the community library in 2010.</p><p><a href="/node/2">Read the timeline</a></p>', 1],
  ['long', 'Community timeline', '<h2>Timeline</h2>' . str_repeat('<p>A public chronological event with enough detail to exercise continuation.</p>', 1400) . '<h2>Final milestone</h2><p>END_OF_LONG_COMPONENT: the final milestone remains retrievable.</p>', 1],
  ['private', 'Unpublished confidential fixture', '<p>PRIVATE_SENTINEL_DO_NOT_RETURN</p>', 0],
] as [$key, $title, $text, $status]) {
  $node = isset($ids[$key]) ? Node::load($ids[$key]) : Node::create(['type' => 'page', 'title' => $title, 'status' => $status]);
  $node->set('body', ['value' => $text, 'format' => 'full_html']); $node->save();
  if (!isset($ids[$key])) MenuLinkContent::create(['title' => $title, 'link' => ['uri' => 'entity:node/' . $node->id()], 'menu_name' => 'main', 'enabled' => TRUE])->save();
  $ids[$key] = (int) $node->id();
}
\Drupal::configFactory()->getEditable('system.site')->set('page.front', '/node/' . $ids['home'])->save();
\Drupal::configFactory()->getEditable('evander_webmcp.settings')->set('enabled_tools', ['evander_get_current_page', 'evander_find_pages', 'evander_read_page', 'get_care_now'])->save();
\Drupal::state()->set('evander_preview.seeded', $ids);
echo json_encode($ids) . "\n";
