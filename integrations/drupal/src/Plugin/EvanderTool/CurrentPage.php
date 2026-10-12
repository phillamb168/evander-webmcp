<?php

namespace Drupal\evander_webmcp\Plugin\EvanderTool;

use Drupal\evander_webmcp\Attribute\EvanderTool;

#[EvanderTool(id: 'evander_get_current_page', title: 'Read the current page', description: 'Read the public content of the current page. Pass the browser page path. Returns exact source chunks, links, and coverage, not private or logged-in content.')]
final class CurrentPage extends ReadPage {}
