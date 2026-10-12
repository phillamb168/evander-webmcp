<?php
require __DIR__ . '/../../integrations/drupal/src/Content/HtmlChunks.php';
require __DIR__ . '/../../integrations/drupal/src/Tool/Schema.php';
use Drupal\evander_webmcp\Content\HtmlChunks;
use Drupal\evander_webmcp\Tool\Schema;
$count = 0;
function check($value, $message) { global $count; if (!$value) throw new RuntimeException($message); $count++; }
$html = HtmlChunks::decorate('<h2>History</h2><p>One paragraph.</p><p>Another.</p><form>secret</form><div hidden>hidden</div><script>bad()</script>', 'fixture');
$result = HtmlChunks::extract($html, 'fixture');
check(count($result['chunks']) === 2, 'Paragraph boundaries');
check($result['chunks'][0]['anchor'] === '#fixture-heading-1', 'Real section anchor');
check(!str_contains(json_encode($result), 'secret'), 'Forms excluded');
check(!str_contains(json_encode($result), 'hidden'), 'Hidden content excluded');
$long = HtmlChunks::extract(HtmlChunks::decorate('<h2>Long</h2><p>' . str_repeat('Résumé paragraph. ', 12000) . '</p>', 'long'), 'long', 2000);
check(count($long['chunks']) > 60, 'Large component retained as many chunks');
foreach ($long['chunks'] as $chunk) { check(strlen($chunk['text']) <= 2000 && mb_check_encoding($chunk['text'], 'UTF-8'), 'UTF-8 byte bound'); }
$table = HtmlChunks::extract('<table><tr><th>Name</th><th>Year</th></tr><tr><td>Example</td><td>2026</td></tr></table>', 'table');
check(str_contains($table['chunks'][1]['text'], 'Columns: Name | Year'), 'Table headers preserved');
$hiddenTable = HtmlChunks::extract('<table><thead hidden><tr><th>HIDDEN_HEADER_SECRET</th></tr></thead><tr hidden><td>HIDDEN_ROW_SECRET</td></tr><tbody hidden><tr><td>HIDDEN_GROUP_SECRET</td></tr></tbody><tr><td>Visible row</td></tr></table>', 'hidden-table');
check(!str_contains(json_encode($hiddenTable), 'SECRET'), 'Hidden table rows and row groups excluded');
$schema = ['type' => 'object', 'properties' => ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10]], 'required' => ['limit'], 'additionalProperties' => FALSE];
Schema::checkSchema($schema); Schema::validate(['limit' => 2], $schema);
foreach ([['limit' => 0], ['limit' => '2'], ['limit' => 2, 'extra' => 1], []] as $input) {
  try { Schema::validate($input, $schema); throw new RuntimeException('Accepted invalid input'); } catch (InvalidArgumentException) { $count++; }
}
$fixtures = json_decode(file_get_contents(__DIR__ . '/../../packages/contracts/fixtures.json'), TRUE, 32, JSON_THROW_ON_ERROR);
$contract = $fixtures['manifest']['tools'][0]['inputSchema'];
Schema::checkSchema($contract); Schema::validate($fixtures['call']['arguments'], $contract);
check($fixtures['manifest']['version'] === '1.0' && $fixtures['page']['version'] === '1.0', 'Shared contract version');
check($fixtures['page']['result']['next']['snapshot'] === $fixtures['page']['result']['snapshot'], 'Shared continuation contract');
echo "$count PHP assertions passed.\n";
